import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CreateRoom, UpdateRoom, type SyncOp, type SyncUploadResult } from '@takhti/contracts';
import {
  registerSyncTable,
  removeSyncTable,
  roomsDb,
  roomsService,
  syncConflict,
  type Actor,
} from '@takhti/core';
import {
  adminDb,
  auditLog,
  rooms,
  syncConflicts,
  syncDevices,
  syncOps,
  syncRejections,
} from '@takhti/db';
import * as upload from '../../../apps/web/app/api/v1/sync/upload/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * The offline upload: docs/plan/00-foundation/14-offline-design.md ("The write path").
 * Tables are registered for these tests over a real service, so what is proved is the loop itself:
 * every operation answered, each applied once, a refusal kept and never in the way of the rest.
 */

let db: TestDb;
let school: TestOrg;
let principal: Actor;
let teacher: Actor;
let guardian: Actor;
let device: string;

const TABLES = ['tests_rooms', 'tests_marks', 'tests_broken', 'tests_family_notes'];

async function addDevice(owner: Actor, code: string, status: 'active' | 'revoked' = 'active') {
  const id = randomUUID();
  await adminDb()
    .insert(syncDevices)
    .values({
      id,
      orgId: school.orgId,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
      userId: owner.userId,
      deviceCode: code,
      name: `Device ${code}`,
      platform: 'web',
      appVersion: '1.0.0',
      status,
    });
  return id;
}

const send = (actor: Actor | undefined, deviceId: string, ops: unknown[]) =>
  callRoute<SyncUploadResult>(upload.POST, {
    ...(actor && { as: actor }),
    method: 'POST',
    url: '/api/v1/sync/upload',
    body: { deviceId, ops },
  });

const opId = () => `op-${randomUUID()}`;
const newRoom = (name: string, overrides: Partial<SyncOp> = {}): SyncOp => ({
  opId: opId(),
  table: 'tests_rooms',
  op: 'PUT',
  id: randomUUID(),
  data: { branchId: school.mainBranchId, name, capacity: 30 },
  ...overrides,
});
const roomRow = async (id: string) =>
  (await adminDb().select().from(rooms).where(eq(rooms.id, id)))[0];

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  principal = await school.actor('principal');
  teacher = await school.actor('class_teacher');
  guardian = await school.actor('guardian');
  device = await addDevice(principal, 'K1');

  // Latest write wins, through the same service the online route calls.
  registerSyncTable({
    table: 'tests_rooms',
    module: 'organisation',
    policy: 'latest-wins',
    apply: {
      PUT: (ctx, op) => roomsService.create(ctx, CreateRoom.parse({ id: op.id, ...op.data })),
      PATCH: async (ctx, op) => {
        const current = await roomsDb.get(ctx, op.id);
        return roomsService.update(
          ctx,
          op.id,
          UpdateRoom.parse({ ...op.data, version: current.version }),
        );
      },
    },
  });
  // The server's value stays when the row moved on while the device was offline.
  registerSyncTable({
    table: 'tests_marks',
    module: 'organisation',
    policy: 'server-wins',
    apply: {
      PATCH: async (ctx, op) => {
        const current = await roomsDb.get(ctx, op.id);
        if (op.baseVersion !== current.version)
          return syncConflict(op.data, { capacity: current.capacity, version: current.version });
        return roomsService.update(ctx, op.id, UpdateRoom.parse({ ...op.data, version: current.version }));
      },
    },
  });
  registerSyncTable({
    table: 'tests_broken',
    module: 'organisation',
    policy: 'always-add',
    apply: {
      PUT: async () => {
        throw new TypeError('a bug in the handler');
      },
    },
  });
  // Something a family may send: it writes nothing a guardian could not.
  registerSyncTable({
    table: 'tests_family_notes',
    module: 'organisation',
    policy: 'always-add',
    apply: { PUT: async () => undefined },
  });
});
afterAll(async () => {
  for (const table of TABLES) removeSyncTable(table);
  await db.destroy();
});

describe('T-shared-9 POST /sync/upload', () => {
  it('applies an operation through the real service, as the person, marked as coming from their device', async () => {
    const op = newRoom('Offline room');
    const response = await send(principal, device, [op]);
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ wipe: false, results: [{ opId: op.opId, result: 'applied' }] });

    // The id the device made is the id of the row.
    expect(await roomRow(op.id)).toMatchObject({
      name: 'Offline room',
      capacity: 30,
      branchId: school.mainBranchId,
      createdBy: principal.userId,
    });
    const [entry] = await adminDb()
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, 'rooms'), eq(auditLog.entityId, op.id)));
    expect(entry).toMatchObject({
      action: 'create',
      source: 'sync',
      deviceId: device,
      actorId: principal.userId,
    });
    const [noted] = await adminDb().select().from(syncOps).where(eq(syncOps.opId, op.opId));
    expect(noted).toMatchObject({ deviceId: device, tableName: 'tests_rooms', result: 'applied' });
    const [row] = await adminDb().select().from(syncDevices).where(eq(syncDevices.id, device));
    expect(row?.lastSyncAt).not.toBeNull();
  });

  it('R-shared-11 the same batch sent twice is acknowledged as duplicate and applied once', async () => {
    const ops = [newRoom('Sent twice A'), newRoom('Sent twice B')];
    const first = await send(principal, device, ops);
    expect(first.data.results.map((result) => result.result)).toEqual(['applied', 'applied']);
    const second = await send(principal, device, ops);
    expect(second.status).toBe(200);
    expect(second.data.results).toEqual(
      ops.map((op) => ({ opId: op.opId, result: 'duplicate' })),
    );
    const made = await adminDb().select().from(rooms).where(eq(rooms.orgId, school.orgId));
    expect(made.filter((room) => room.name.startsWith('Sent twice'))).toHaveLength(2);
  });

  it('R-shared-12 an operation on a table that is not writable offline, or of a kind it does not take, is rejected with FORBIDDEN and kept for the person', async () => {
    const unknown = { ...newRoom('x'), table: 'fee_structures' };
    const removal: SyncOp = { opId: opId(), table: 'tests_rooms', op: 'DELETE', id: randomUUID() };
    const response = await send(principal, device, [unknown, removal]);
    expect(response.status).toBe(200);
    expect(response.data.results).toEqual([
      {
        opId: unknown.opId,
        result: 'rejected',
        code: 'FORBIDDEN',
        message: 'This cannot be changed while offline',
      },
      {
        opId: removal.opId,
        result: 'rejected',
        code: 'FORBIDDEN',
        message: 'This cannot be changed while offline',
      },
    ]);
    const [kept] = await adminDb()
      .select()
      .from(syncRejections)
      .where(eq(syncRejections.opId, unknown.opId));
    expect(kept).toMatchObject({
      userId: principal.userId,
      deviceId: device,
      tableName: 'fee_structures',
      entityId: unknown.id,
      reasonCode: 'FORBIDDEN',
      reason: 'This cannot be changed while offline',
      resolvedAt: null,
      payload: { op: 'PUT', data: unknown.data, baseVersion: null },
    });
    // Sent again, it is not refused a second time.
    const again = await send(principal, device, [unknown]);
    expect(again.data.results).toEqual([{ opId: unknown.opId, result: 'duplicate' }]);
    expect(
      await adminDb().select().from(syncRejections).where(eq(syncRejections.opId, unknown.opId)),
    ).toHaveLength(1);
  });

  it('F-shared-8 a batch with bad operations in it: each is rejected alone, with its reason, and the others apply', async () => {
    const good = newRoom('Mixed batch 1');
    const invalid = newRoom('', { data: { branchId: school.mainBranchId, name: '' } });
    const elsewhere = newRoom('In a branch they do not work at', {
      data: { branchId: school.cityBranchId, name: 'City room' },
    });
    const clash = newRoom('Mixed batch 1');
    const change: SyncOp = {
      opId: opId(),
      table: 'tests_rooms',
      op: 'PATCH',
      id: good.id,
      data: { capacity: 42 },
    };
    const response = await send(principal, device, [good, invalid, elsewhere, clash, change]);
    expect(response.status).toBe(200);
    expect(response.data.results.map((result) => [result.result, result.code])).toEqual([
      ['applied', undefined],
      ['rejected', 'VALIDATION'],
      ['rejected', 'FORBIDDEN'],
      ['rejected', 'CONFLICT'],
      ['applied', undefined],
    ]);
    expect(response.data.results[3]?.message).toBe('This branch already has a room with this name');
    // The change after the three refusals went through: it was never blocked by them.
    expect(await roomRow(good.id)).toMatchObject({ name: 'Mixed batch 1', capacity: 42 });
    expect(await roomRow(invalid.id)).toBeUndefined();
    expect(await roomRow(elsewhere.id)).toBeUndefined();
    expect(await roomRow(clash.id)).toBeUndefined();
    const kept = await adminDb()
      .select()
      .from(syncRejections)
      .where(eq(syncRejections.entityId, clash.id));
    expect(kept).toHaveLength(1);
  });

  it('a row that moved on while the device was offline: the server value stays and the device value waits for a decision', async () => {
    const room = newRoom('Marks stand-in');
    await send(principal, device, [room]);
    // Someone changes it online: the row is now at version 2.
    await send(principal, device, [
      { opId: opId(), table: 'tests_rooms', op: 'PATCH', id: room.id, data: { capacity: 31 } },
    ]);
    const stale: SyncOp = {
      opId: opId(),
      table: 'tests_marks',
      op: 'PATCH',
      id: room.id,
      data: { capacity: 99 },
      baseVersion: 1,
    };
    const response = await send(principal, device, [stale]);
    expect(response.data.results[0]).toMatchObject({ opId: stale.opId, result: 'conflict' });
    expect((await roomRow(room.id))?.capacity).toBe(31);
    const [conflict] = await adminDb()
      .select()
      .from(syncConflicts)
      .where(eq(syncConflicts.entityId, room.id));
    expect(conflict).toMatchObject({
      deviceId: device,
      tableName: 'tests_marks',
      status: 'open',
      deviceValue: { capacity: 99 },
      serverValue: { capacity: 31, version: 2 },
    });
    // With the version the server holds, the same change is simply applied.
    const fresh = await send(principal, device, [{ ...stale, opId: opId(), baseVersion: 2 }]);
    expect(fresh.data.results[0]?.result).toBe('applied');
    expect((await roomRow(room.id))?.capacity).toBe(99);
  });

  it('R-shared-13 a revoked device is told to wipe, and nothing it sent is applied', async () => {
    const revoked = await addDevice(principal, 'K2', 'revoked');
    const op = newRoom('From a revoked device');
    const response = await send(principal, revoked, [op]);
    expect(response.status).toBe(200);
    expect(response.data).toEqual({ wipe: true, results: [] });
    expect(await roomRow(op.id)).toBeUndefined();
    expect(await adminDb().select().from(syncOps).where(eq(syncOps.opId, op.opId))).toEqual([]);
  });

  it('a device belongs to one person: nobody else can upload as it, and without a session nobody can upload at all', async () => {
    const op = newRoom('Through another person’s device');
    expect((await send(teacher, device, [op])).status).toBe(404);
    expect((await send(principal, randomUUID(), [op])).status).toBe(404);
    expect((await send(undefined, device, [op])).status).toBe(401);
    expect(await roomRow(op.id)).toBeUndefined();
  });

  it('an error nobody expected stops the batch with a server error and keeps none of it, so the device can send it again', async () => {
    const before = newRoom('Before the bug');
    const bug: SyncOp = { opId: opId(), table: 'tests_broken', op: 'PUT', id: randomUUID() };
    const response = await send(principal, device, [before, bug]);
    expect(response.status).toBe(500);
    expect(await roomRow(before.id)).toBeUndefined();
    expect(await adminDb().select().from(syncOps).where(eq(syncOps.opId, before.opId))).toEqual([]);
    // Sent again without the broken operation, the first one applies.
    const retry = await send(principal, device, [before]);
    expect(retry.data.results).toEqual([{ opId: before.opId, result: 'applied' }]);
  });

  it('a family’s device: what it may send is applied once, although a family cannot read the log of operations', async () => {
    const phone = await addDevice(guardian, 'F1');
    const note: SyncOp = { opId: opId(), table: 'tests_family_notes', op: 'PUT', id: randomUUID() };
    const first = await send(guardian, phone, [note]);
    expect(first.data.results).toEqual([{ opId: note.opId, result: 'applied' }]);
    const second = await send(guardian, phone, [note]);
    expect(second.data.results).toEqual([{ opId: note.opId, result: 'duplicate' }]);
    // And what a family may not do is refused through the service, like anyone else's.
    const room = newRoom('A guardian adding a room');
    const refused = await send(guardian, phone, [room]);
    expect(refused.data.results[0]).toMatchObject({ result: 'rejected', code: 'FORBIDDEN' });
    expect(await roomRow(room.id)).toBeUndefined();
    const again = await send(guardian, phone, [room]);
    expect(again.data.results).toEqual([{ opId: room.opId, result: 'duplicate' }]);
  });

  it('an upload carries one to five hundred operations, each well formed', async () => {
    expect((await send(principal, device, [])).status).toBe(422);
    const many = Array.from({ length: 501 }, (_value, index) => newRoom(`Too many ${index}`));
    expect((await send(principal, device, many)).status).toBe(422);
    expect((await send(principal, device, [{ ...newRoom('x'), table: 'Not A Table' }])).status).toBe(422);
    expect((await send(principal, device, [{ ...newRoom('x'), id: 'not-an-id' }])).status).toBe(422);
  });
});
