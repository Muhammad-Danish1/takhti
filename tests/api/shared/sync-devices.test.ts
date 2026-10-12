import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  DEVICE_CODE_ALPHABET,
  type Page,
  type SyncConflictItem,
  type SyncDevice,
  type SyncRejection,
  type SyncUploadResult,
} from '@takhti/contracts';
import {
  registerSyncTable,
  removeSyncTable,
  rule,
  syncConflict,
  type Actor,
  type WaitingConflict,
} from '@takhti/core';
import { adminDb, auditLog, syncConflicts, syncDevices } from '@takhti/db';
import * as conflictResolve from '../../../apps/web/app/api/v1/sync/conflicts/[id]/resolve/route';
import * as conflictList from '../../../apps/web/app/api/v1/sync/conflicts/route';
import * as deviceRevoke from '../../../apps/web/app/api/v1/sync/devices/[id]/revoke/route';
import * as deviceList from '../../../apps/web/app/api/v1/sync/devices/route';
import * as rejectionDismiss from '../../../apps/web/app/api/v1/sync/rejections/[id]/dismiss/route';
import * as rejectionList from '../../../apps/web/app/api/v1/sync/rejections/route';
import * as upload from '../../../apps/web/app/api/v1/sync/upload/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, type TestOrg } from '../../helpers/world';

/*
 * The devices that work offline, what the server refused from them and the conflicts a person
 * decides: docs/plan/10-modules/m00-shared-kernel.md and docs/plan/00-foundation/14-offline-design.md.
 * The upload loop itself is proved in tests/api/kernel/sync.test.ts.
 */

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let principal: Actor;
let itAdmin: Actor;
let cashier: Actor;
let teacher: Actor;
let coordinator: Actor;
let guardian: Actor;
let outsider: Actor;

const TABLES = ['tests_marks', 'tests_plain_marks'];
const taken: { by: string; conflict: WaitingConflict }[] = [];
let refuseTaking = false;

const register = (actor: Actor, body: Record<string, unknown> = {}) =>
  callRoute<SyncDevice>(deviceList.POST, {
    as: actor,
    method: 'POST',
    url: '/api/v1/sync/devices',
    body: { name: 'Office laptop', platform: 'web', appVersion: '1.4.0', ...body },
  });

const send = (actor: Actor, deviceId: string, table: string, data: Record<string, unknown> = {}) =>
  callRoute<SyncUploadResult>(upload.POST, {
    as: actor,
    method: 'POST',
    url: '/api/v1/sync/upload',
    body: {
      deviceId,
      ops: [{ opId: `op-${randomUUID()}`, table, op: 'PATCH', id: randomUUID(), data, baseVersion: 1 }],
    },
  });

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  principal = await school.actor('principal');
  itAdmin = await school.actor('it_admin');
  cashier = await school.actor('cashier');
  teacher = await school.actor('class_teacher');
  coordinator = await school.actor('coordinator');
  guardian = await school.actor('guardian');
  outsider = await other.actor('principal');

  // A judgement, such as a mark: the server's value stays and the device's waits for a person.
  registerSyncTable({
    table: 'tests_marks',
    module: 'students',
    policy: 'server-wins',
    apply: { PATCH: (_ctx, op) => Promise.resolve(syncConflict(op.data, { marks: 61 })) },
    takeDevice: (ctx, conflict) => {
      if (refuseTaking) throw rule('Marks for this exam are locked');
      taken.push({ by: ctx.actor.userId, conflict });
      return Promise.resolve();
    },
  });
  // The same, from a module that gave no way to apply the device's value afterwards.
  registerSyncTable({
    table: 'tests_plain_marks',
    module: 'students',
    policy: 'server-wins',
    apply: { PATCH: (_ctx, op) => Promise.resolve(syncConflict(op.data, { marks: 40 })) },
  });
});
afterAll(async () => {
  for (const table of TABLES) removeSyncTable(table);
  await db.destroy();
});

describe('devices', () => {
  it('switching offline mode on registers the device and gives it a code no other device of the school has', async () => {
    const first = await register(cashier, { name: '  Counter 1  ' });
    expect(first.status).toBe(200);
    expect(first.data).toMatchObject({
      userId: cashier.userId,
      userName: 'Bilal Aslam',
      name: 'Counter 1',
      platform: 'web',
      appVersion: '1.4.0',
      status: 'active',
      pendingCount: 0,
      lastSyncAt: null,
      revokedBy: null,
    });
    const code = new RegExp(`^[${DEVICE_CODE_ALPHABET}]{2}$`);
    expect(first.data.deviceCode).toMatch(code);

    const codes = new Set([first.data.deviceCode]);
    for (let index = 0; index < 40; index++) {
      const next = await register(index % 2 ? cashier : teacher, { name: `Tablet ${index}` });
      expect(next.data.deviceCode).toMatch(code);
      codes.add(next.data.deviceCode);
    }
    expect(codes.size).toBe(41);
    // A family may work offline too, and its device is written down like any other.
    expect((await register(guardian, { platform: 'android', name: 'My phone' })).status).toBe(200);
    expect((await register(cashier, { platform: 'windows' })).status).toBe(422);
    expect((await register(cashier, { name: ' ' })).status).toBe(422);
  });

  it('a device that registers again with its id checks in: it reports what it still holds and keeps its code', async () => {
    const id = randomUUID();
    const first = await register(teacher, { id, name: 'Class tablet' });
    expect(first.data.id).toBe(id);
    const again = await register(teacher, { id, name: 'Class tablet 5-A', appVersion: '1.5.0', pendingCount: 12 });
    expect(again.data).toMatchObject({
      id,
      deviceCode: first.data.deviceCode,
      name: 'Class tablet 5-A',
      appVersion: '1.5.0',
      pendingCount: 12,
      status: 'active',
    });
    // Without a count, the last one reported stands.
    expect((await register(teacher, { id, name: 'Class tablet 5-A' })).data.pendingCount).toBe(12);
    // Somebody else's device is, to this person, not a device.
    expect((await register(cashier, { id })).status).toBe(404);
    expect((await register(outsider, { id })).status).toBe(404);
  });

  it('an administrator sees every device, those holding unsynced work first, and can revoke one', async () => {
    const listed = await callRoute<Page<SyncDevice>>(deviceList.GET, {
      as: itAdmin,
      url: '/api/v1/sync/devices?pageSize=100',
    });
    expect(listed.status).toBe(200);
    expect(listed.data.total).toBe(43);
    expect(listed.data.items[0]).toMatchObject({ name: 'Class tablet 5-A', pendingCount: 12, userName: 'Nadia Hussain' });
    const waiting = await callRoute<Page<SyncDevice>>(deviceList.GET, {
      as: principal,
      url: '/api/v1/sync/devices?pending=true',
    });
    expect(waiting.data.items.map((device) => device.name)).toEqual(['Class tablet 5-A']);
    const ofCashier = await callRoute<Page<SyncDevice>>(deviceList.GET, {
      as: principal,
      url: `/api/v1/sync/devices?userId=${cashier.userId}&pageSize=100`,
    });
    expect(ofCashier.data.total).toBe(21);

    expect((await callRoute(deviceList.GET, { as: teacher, url: '/api/v1/sync/devices' })).status).toBe(403);
    expect((await callRoute(deviceList.GET, { as: guardian, url: '/api/v1/sync/devices' })).status).toBe(403);
    const elsewhere = await callRoute<Page<SyncDevice>>(deviceList.GET, {
      as: outsider,
      url: '/api/v1/sync/devices',
    });
    expect(elsewhere.data.total).toBe(0);
  });

  it('R-shared-13 a revoked device is refused, told to delete what it holds, and stays revoked when it checks in', async () => {
    const id = randomUUID();
    await register(teacher, { id, name: 'Lost phone', platform: 'android' });
    const revoke = (actor: Actor, deviceId = id) =>
      callRoute<SyncDevice>(deviceRevoke.POST, {
        as: actor,
        method: 'POST',
        url: '/x',
        params: { id: deviceId },
      });
    expect((await revoke(teacher)).status).toBe(403);
    expect((await revoke(outsider)).status).toBe(404);
    expect((await revoke(itAdmin, randomUUID())).status).toBe(404);

    const revoked = await revoke(itAdmin);
    expect(revoked.status).toBe(200);
    expect(revoked.data).toMatchObject({ id, status: 'revoked', revokedBy: itAdmin.userId });
    // Revoking again changes nothing.
    expect((await revoke(principal)).data).toMatchObject({ status: 'revoked', revokedBy: itAdmin.userId });
    const entries = await adminDb().select().from(auditLog).where(eq(auditLog.entityId, id));
    expect(entries.map((entry) => entry.action).sort()).toEqual(['register', 'revoke']);

    const sent = await send(teacher, id, 'tests_marks', { marks: 70 });
    expect(sent.data).toEqual({ wipe: true, results: [] });
    const checkIn = await register(teacher, { id, name: 'Found again', pendingCount: 3 });
    expect(checkIn.data).toMatchObject({ status: 'revoked', name: 'Lost phone', pendingCount: 0 });
    const active = await callRoute<Page<SyncDevice>>(deviceList.GET, {
      as: itAdmin,
      url: '/api/v1/sync/devices?status=revoked',
    });
    expect(active.data.items.map((device) => device.name)).toEqual(['Lost phone']);
  });
});

describe('refused changes', () => {
  const list = (actor: Actor, query = '') =>
    callRoute<Page<SyncRejection>>(rejectionList.GET, {
      as: actor,
      url: `/api/v1/sync/rejections${query}`,
    });
  const dismiss = (actor: Actor, id: string) =>
    callRoute<SyncRejection>(rejectionDismiss.POST, {
      as: actor,
      method: 'POST',
      url: '/x',
      params: { id },
    });

  it('a person sees their own refused changes with the reason, and marks each as dealt with', async () => {
    const device = (await register(cashier, { name: 'Counter 2' })).data.id;
    const first = await send(cashier, device, 'tests_never_registered', { amount: 5 });
    expect(first.data.results[0]).toMatchObject({ result: 'rejected', code: 'FORBIDDEN' });
    await send(cashier, device, 'tests_never_registered', { amount: 6 });

    const mine = await list(cashier);
    expect(mine.data.total).toBe(2);
    expect(mine.data.items[0]).toMatchObject({
      deviceId: device,
      tableName: 'tests_never_registered',
      reasonCode: 'FORBIDDEN',
      reason: 'This cannot be changed while offline',
      resolvedAt: null,
    });
    expect(mine.data.items[0]?.payload).toMatchObject({ op: 'PATCH', baseVersion: 1 });
    // They are nobody else's business, not even an administrator's.
    expect((await list(principal)).data.total).toBe(0);
    expect((await list(guardian)).data.total).toBe(0);

    const target = mine.data.items[0] as SyncRejection;
    expect((await dismiss(principal, target.id)).status).toBe(404);
    const done = await dismiss(cashier, target.id);
    expect(done.status).toBe(200);
    expect(done.data.resolvedAt).not.toBeNull();
    // Dismissing again changes nothing.
    expect((await dismiss(cashier, target.id)).data.resolvedAt).toBe(done.data.resolvedAt);

    expect((await list(cashier)).data.total).toBe(1);
    expect((await list(cashier, '?dismissed=true')).data.total).toBe(2);
    expect((await list(cashier, `?deviceId=${randomUUID()}`)).data.total).toBe(0);
  });
});

describe('conflicts', () => {
  const list = (actor: Actor, query = '') =>
    callRoute<Page<SyncConflictItem>>(conflictList.GET, {
      as: actor,
      url: `/api/v1/sync/conflicts${query}`,
    });
  const resolve = (actor: Actor, id: string, resolution: string) =>
    callRoute<SyncConflictItem>(conflictResolve.POST, {
      as: actor,
      method: 'POST',
      url: '/x',
      params: { id },
      body: { resolution },
    });
  let device: string;

  it('a value the server set aside waits, with both values, for someone permitted to decide', async () => {
    device = (await register(teacher, { name: 'Marks tablet' })).data.id;
    const sent = await send(teacher, device, 'tests_marks', { marks: 78 });
    expect(sent.data.results[0]?.result).toBe('conflict');
    await send(teacher, device, 'tests_marks', { marks: 55 });
    await send(teacher, device, 'tests_plain_marks', { marks: 49 });

    const open = await list(coordinator);
    expect(open.status).toBe(200);
    expect(open.data.total).toBe(3);
    // Oldest first: the one that has waited longest is decided first.
    expect(open.data.items[0]).toMatchObject({
      deviceId: device,
      deviceName: 'Marks tablet',
      userName: 'Nadia Hussain',
      tableName: 'tests_marks',
      deviceValue: { marks: 78 },
      serverValue: { marks: 61 },
      status: 'open',
      resolvedBy: null,
    });
    expect((await list(coordinator, '?tableName=tests_plain_marks')).data.total).toBe(1);
    expect((await list(cashier)).status).toBe(403);
    expect((await list(guardian)).status).toBe(403);
    expect((await list(outsider)).data.total).toBe(0);
  });

  it('keeping the server’s value closes the conflict and changes nothing else', async () => {
    const [first] = (await list(coordinator, '?tableName=tests_marks')).data.items;
    const kept = await resolve(coordinator, first!.id, 'keep_server');
    expect(kept.status).toBe(200);
    expect(kept.data).toMatchObject({ status: 'kept_server', resolvedBy: coordinator.userId });
    expect(kept.data.resolvedAt).not.toBeNull();
    expect(taken).toEqual([]);
    // A decision is taken once.
    const again = await resolve(principal, first!.id, 'take_device');
    expect(again.status).toBe(409);
    expect(again.error?.message).toBe('This conflict has already been decided');
    expect((await list(coordinator, '?status=kept_server')).data.total).toBe(1);
  });

  it('taking the device’s value hands it to the module, as the person deciding; if the module refuses, the conflict stays open', async () => {
    const [waiting] = (await list(coordinator, '?tableName=tests_marks')).data.items;
    refuseTaking = true;
    const refused = await resolve(coordinator, waiting!.id, 'take_device');
    expect(refused.status).toBe(409);
    expect(refused.error?.message).toBe('Marks for this exam are locked');
    refuseTaking = false;
    const [still] = await adminDb().select().from(syncConflicts).where(eq(syncConflicts.id, waiting!.id));
    expect(still).toMatchObject({ status: 'open', resolvedBy: null });

    const done = await resolve(principal, waiting!.id, 'take_device');
    expect(done.data).toMatchObject({ status: 'took_device', resolvedBy: principal.userId });
    expect(taken).toEqual([
      {
        by: principal.userId,
        conflict: {
          id: waiting!.id,
          entityId: waiting!.entityId,
          deviceValue: { marks: 55 },
          serverValue: { marks: 61 },
        },
      },
    ]);
  });

  it('where the module gave no way to apply a device’s value, the server’s is the only choice', async () => {
    const [plain] = (await list(coordinator)).data.items;
    expect(plain?.tableName).toBe('tests_plain_marks');
    const no = await resolve(coordinator, plain!.id, 'take_device');
    expect(no.status).toBe(409);
    expect(no.error?.message).toMatch(/cannot be applied from here/);
    expect((await resolve(coordinator, plain!.id, 'merge')).status).toBe(422);
    expect((await resolve(cashier, plain!.id, 'keep_server')).status).toBe(403);
    expect((await resolve(outsider, plain!.id, 'keep_server')).status).toBe(404);
    expect((await resolve(coordinator, plain!.id, 'keep_server')).data.status).toBe('kept_server');
    expect((await list(coordinator)).data.total).toBe(0);
    const [row] = await adminDb().select().from(syncDevices).where(eq(syncDevices.id, device));
    expect(row?.lastSyncAt).not.toBeNull();
  });
});
