import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Attachment, FileLink, UploadTicket } from '@takhti/contracts';
import { memoryStorage, setStorageProvider, type Actor } from '@takhti/core';
import { adminDb, attachments, auditLog, files, rooms } from '@takhti/db';
import * as attachmentItem from '../../../apps/web/app/api/v1/attachments/[id]/route';
import * as attachmentList from '../../../apps/web/app/api/v1/attachments/route';
import * as confirm from '../../../apps/web/app/api/v1/files/[id]/confirm/route';
import * as fileItem from '../../../apps/web/app/api/v1/files/[id]/route';
import * as fileUrl from '../../../apps/web/app/api/v1/files/[id]/url/route';
import * as uploads from '../../../apps/web/app/api/v1/files/uploads/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * Files and attachments through their routes.
 * Rules, failure cases and tests: docs/plan/10-modules/m00-shared-kernel.md.
 */

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let principal: Actor;
let cityPrincipal: Actor;
let teacher: Actor;
let guardian: Actor;
let outsider: Actor;
let roomId: string;
const store = memoryStorage();

const pdf = { purpose: 'document', fileName: 'Lab safety rules.pdf', mimeType: 'application/pdf', size: 2048 };

const start = (actor: Actor | undefined, body: unknown = pdf) =>
  callRoute<UploadTicket>(uploads.POST, {
    ...(actor && { as: actor }),
    method: 'POST',
    url: '/api/v1/files/uploads',
    body,
  });
const finish = (actor: Actor, id: string) =>
  callRoute<{ id: string; status: string }>(confirm.POST, {
    as: actor,
    method: 'POST',
    url: `/api/v1/files/${id}/confirm`,
    params: { id },
  });
const link = (actor: Actor, id: string) =>
  callRoute<FileLink>(fileUrl.GET, { as: actor, url: `/api/v1/files/${id}/url`, params: { id } });
const withdraw = (actor: Actor, id: string) =>
  callRoute(fileItem.DELETE, {
    as: actor,
    method: 'DELETE',
    url: `/api/v1/files/${id}`,
    params: { id },
  });
const attachTo = (actor: Actor, body: unknown) =>
  callRoute<Attachment>(attachmentList.POST, {
    as: actor,
    method: 'POST',
    url: '/api/v1/attachments',
    body,
  });
const attached = (actor: Actor, entityType: string, entityId: string) =>
  callRoute<Attachment[]>(attachmentList.GET, {
    as: actor,
    url: `/api/v1/attachments?entityType=${entityType}&entityId=${entityId}`,
  });
const detachFrom = (actor: Actor, id: string) =>
  callRoute(attachmentItem.DELETE, {
    as: actor,
    method: 'DELETE',
    url: `/api/v1/attachments/${id}`,
    params: { id },
  });

const fileRow = async (id: string) =>
  (await adminDb().select().from(files).where(eq(files.id, id)))[0]!;

/** Does what the browser does with the upload link: puts the bytes where the link points. */
async function sendBytes(fileId: string, size: number, mimeType = 'application/pdf') {
  const file = await fileRow(fileId);
  await store.put(file.bucket, file.path, new Uint8Array(size), mimeType);
}

/** A file that went all the way: announced, uploaded and confirmed. */
async function readyFile(actor: Actor, body: Record<string, unknown> = pdf): Promise<string> {
  const ticket = await start(actor, body);
  await sendBytes(ticket.data.fileId, Number(body.size), String(body.mimeType));
  expect((await finish(actor, ticket.data.fileId)).status).toBe(200);
  return ticket.data.fileId;
}

beforeAll(async () => {
  db = await createTestDb();
  setStorageProvider(store);
  school = await seedOrg();
  other = await seedOrg();
  principal = await school.actor('principal');
  cityPrincipal = await school.actor('principal', { branch: 'city' });
  teacher = await school.actor('class_teacher');
  guardian = await school.actor('guardian');
  outsider = await other.actor('principal');
  roomId = randomUUID();
  await adminDb()
    .insert(rooms)
    .values({
      id: roomId,
      orgId: school.orgId,
      createdAt: TEST_NOW,
      updatedAt: TEST_NOW,
      branchId: school.mainBranchId,
      name: 'Physics lab',
      kind: 'lab',
    });
});
afterAll(async () => {
  setStorageProvider(undefined);
  await db.destroy();
});

describe('uploading a file', () => {
  it('T-shared-1 announce, upload, confirm: the file is ready and its uploader can get a link to it', async () => {
    const ticket = await start(principal);
    expect(ticket.status).toBe(201);
    expect(ticket.data.uploadUrl).toBeTruthy();
    expect(await fileRow(ticket.data.fileId)).toMatchObject({
      status: 'pending',
      purpose: 'document',
      bucket: 'documents',
      originalName: 'Lab safety rules.pdf',
      uploadedBy: principal.userId,
    });
    // R-shared-1: not usable until it is ready.
    expect((await link(principal, ticket.data.fileId)).status).toBe(409);

    await sendBytes(ticket.data.fileId, 2048);
    expect((await finish(principal, ticket.data.fileId)).data).toEqual({
      id: ticket.data.fileId,
      status: 'ready',
    });
    const opened = await link(principal, ticket.data.fileId);
    expect(opened.status).toBe(200);
    expect(opened.data.url).toContain(ticket.data.fileId);
    // Good for five minutes.
    const life = Date.parse(opened.data.expiresAt) - Date.now();
    expect(life).toBeGreaterThan(4 * 60_000);
    expect(life).toBeLessThanOrEqual(5 * 60_000);
  });

  it('R-shared-1 a file that has not arrived cannot be confirmed; confirming twice changes nothing', async () => {
    const ticket = await start(principal);
    expect((await finish(principal, ticket.data.fileId)).status).toBe(409);
    await sendBytes(ticket.data.fileId, 2048);
    expect((await finish(principal, ticket.data.fileId)).status).toBe(200);
    expect((await finish(principal, ticket.data.fileId)).status).toBe(200);
    // Only the person who started an upload can finish it.
    const mine = await start(teacher);
    await sendBytes(mine.data.fileId, 2048);
    expect((await finish(principal, mine.data.fileId)).status).toBe(404);
  });

  it('F-shared-2 / T-shared-2 what arrives is not what was announced: the file is quarantined, and stays quarantined', async () => {
    const ticket = await start(principal);
    await sendBytes(ticket.data.fileId, 2048, 'application/x-msdownload');
    const response = await finish(principal, ticket.data.fileId);
    // An answer, not an error: an error would undo the mark that records the quarantine.
    expect(response.status).toBe(200);
    expect(response.data).toEqual({
      id: ticket.data.fileId,
      status: 'quarantined',
      reason: 'This file type is not allowed',
    });
    const row = await fileRow(ticket.data.fileId);
    expect(row.status).toBe('quarantined');
    // What arrived was removed from storage, and the file can be neither opened nor used.
    expect(await store.stat(row.bucket, row.path)).toBeNull();
    expect((await link(principal, ticket.data.fileId)).status).toBe(409);
    expect((await finish(principal, ticket.data.fileId)).status).toBe(409);
    const attachIt = await attachTo(principal, {
      entityType: 'rooms',
      entityId: roomId,
      fileId: ticket.data.fileId,
    });
    expect(attachIt.status).toBe(422);
  });

  it('R-shared-1 a file that arrives empty, or larger than its purpose allows, is quarantined too', async () => {
    const empty = await start(principal);
    await sendBytes(empty.data.fileId, 0);
    expect((await finish(principal, empty.data.fileId)).data).toMatchObject({
      status: 'quarantined',
      reason: 'The file is empty',
    });
    const huge = await start(principal);
    await sendBytes(huge.data.fileId, 10 * 1024 * 1024 + 1);
    expect((await finish(principal, huge.data.fileId)).data).toMatchObject({
      status: 'quarantined',
      reason: 'The file is larger than allowed',
    });
  });

  it('a file too large for its purpose, or of a kind the purpose does not take, is refused before any link is issued', async () => {
    const tooLarge = await start(principal, { ...pdf, size: 11 * 1024 * 1024 });
    expect(tooLarge.status).toBe(422);
    expect(tooLarge.error?.fields).toHaveProperty('size');
    const wrongKind = await start(principal, { ...pdf, mimeType: 'video/mp4' });
    expect(wrongKind.error?.fields).toHaveProperty('mimeType');
    expect((await start(undefined)).status).toBe(401);
  });

  it('a family may upload what a family hands in; nobody uploads what only the server makes', async () => {
    const proof = { purpose: 'payment_proof', fileName: 'transfer.png', mimeType: 'image/png', size: 900 };
    expect((await start(guardian, proof)).status).toBe(201);
    const sheet = { purpose: 'import', fileName: 'students.csv', mimeType: 'text/csv', size: 900 };
    expect((await start(guardian, sheet)).status).toBe(403);
    expect((await start(principal, sheet)).status).toBe(201);
    const made = { purpose: 'generated', fileName: 'receipt.pdf', mimeType: 'application/pdf', size: 900 };
    expect((await start(principal, made)).status).toBe(403);
  });
});

describe('attaching a file to a record', () => {
  it('T-shared-1 a file attached to a record is listed with it, and anyone who can read the record can open it', async () => {
    const fileId = await readyFile(principal);
    const made = await attachTo(principal, {
      entityType: 'rooms',
      entityId: roomId,
      fileId,
      label: 'Safety rules',
    });
    expect(made.status).toBe(201);
    expect(made.data).toMatchObject({
      entityType: 'rooms',
      entityId: roomId,
      fileId,
      label: 'Safety rules',
      sortOrder: 0,
      file: { name: 'Lab safety rules.pdf', mimeType: 'application/pdf', sizeBytes: 2048, status: 'ready' },
    });

    // A teacher reads rooms, so sees the list and may open the file, though she did not upload it.
    const seen = await attached(teacher, 'rooms', roomId);
    expect(seen.data.map((item) => item.id)).toEqual([made.data.id]);
    expect((await link(teacher, fileId)).status).toBe(200);

    const [entry] = await adminDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityId, roomId));
    expect(entry).toMatchObject({ entity: 'rooms', action: 'attach', actorId: principal.userId });
  });

  it('R-shared-3 / T-shared-1 someone who cannot read the record is told the file does not exist', async () => {
    const fileId = await readyFile(principal);
    await attachTo(principal, { entityType: 'rooms', entityId: roomId, fileId });
    // The principal of City Campus cannot see a room of Main Campus.
    expect((await link(cityPrincipal, fileId)).status).toBe(404);
    expect((await attached(cityPrincipal, 'rooms', roomId)).status).toBe(404);
    // A family reads no staff file; another school reaches nothing at all.
    expect((await link(guardian, fileId)).status).toBe(404);
    expect((await link(outsider, fileId)).status).toBe(404);
    expect((await attached(outsider, 'rooms', roomId)).status).toBe(404);
    // A file that is attached to nothing is its uploader's alone.
    const loose = await readyFile(principal);
    expect((await link(teacher, loose)).status).toBe(404);
  });

  it('R-shared-2 only someone who can change the record may attach to it or detach from it', async () => {
    const fileId = await readyFile(teacher);
    const refused = await attachTo(teacher, { entityType: 'rooms', entityId: roomId, fileId });
    expect(refused.status).toBe(403);
    expect(refused.error?.message).toBe('You can see this record but not attach files to it');
    expect((await attachTo(cityPrincipal, { entityType: 'rooms', entityId: roomId, fileId })).status).toBe(404);

    const mine = await attachTo(principal, { entityType: 'rooms', entityId: roomId, fileId });
    expect(mine.status).toBe(201);
    expect((await detachFrom(teacher, mine.data.id)).status).toBe(403);
    expect((await detachFrom(cityPrincipal, mine.data.id)).status).toBe(404);
    expect((await detachFrom(principal, mine.data.id)).status).toBe(204);
    expect((await detachFrom(principal, mine.data.id)).status).toBe(404);
    const left = await adminDb().select().from(attachments).where(eq(attachments.id, mine.data.id));
    expect(left[0]?.deletedAt).not.toBeNull();
  });

  it('a kind of record nobody registered, a record that does not exist, and a file that is not ready are each refused', async () => {
    const fileId = await readyFile(principal);
    expect(
      (await attachTo(principal, { entityType: 'spaceships', entityId: roomId, fileId })).status,
    ).toBe(404);
    expect(
      (await attachTo(principal, { entityType: 'rooms', entityId: randomUUID(), fileId })).status,
    ).toBe(404);
    const pending = await start(principal);
    const notReady = await attachTo(principal, {
      entityType: 'rooms',
      entityId: roomId,
      fileId: pending.data.fileId,
    });
    expect(notReady.status).toBe(422);
    expect(notReady.error?.fields).toEqual({ fileId: ['The file has not finished uploading'] });
    expect((await attached(principal, 'Not A Kind', roomId)).status).toBe(422);
  });

  it('files are listed in the order they were attached', async () => {
    const room = randomUUID();
    await adminDb()
      .insert(rooms)
      .values({
        id: room,
        orgId: school.orgId,
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
        branchId: school.mainBranchId,
        name: 'Chemistry lab',
        kind: 'lab',
      });
    for (const label of ['First', 'Second', 'Third']) {
      const fileId = await readyFile(principal);
      await attachTo(principal, { entityType: 'rooms', entityId: room, fileId, label });
    }
    const listed = await attached(principal, 'rooms', room);
    expect(listed.data.map((item) => [item.label, item.sortOrder])).toEqual([
      ['First', 0],
      ['Second', 1],
      ['Third', 2],
    ]);
  });
});

describe('withdrawing an upload', () => {
  it('its uploader may delete a file that is attached to nothing; nobody else may', async () => {
    const fileId = await readyFile(principal);
    expect((await withdraw(teacher, fileId)).status).toBe(404);
    expect((await withdraw(principal, fileId)).status).toBe(204);
    expect(await fileRow(fileId)).toMatchObject({ status: 'deleted' });
    expect((await link(principal, fileId)).status).toBe(404);
    expect((await withdraw(principal, fileId)).status).toBe(404);
  });

  it('a file attached to a record is removed from the record first', async () => {
    const fileId = await readyFile(principal);
    const made = await attachTo(principal, { entityType: 'rooms', entityId: roomId, fileId });
    const refused = await withdraw(principal, fileId);
    expect(refused.status).toBe(409);
    expect(refused.error?.message).toBe(
      'This file is attached to a record. Remove it from the record first.',
    );
    await detachFrom(principal, made.data.id);
    expect((await withdraw(principal, fileId)).status).toBe(204);
  });

  it('a family may withdraw an upload until it is confirmed; after that it has been handed in', async () => {
    const proof = { purpose: 'payment_proof', fileName: 'transfer.png', mimeType: 'image/png', size: 900 };
    const early = await start(guardian, proof);
    expect((await withdraw(guardian, early.data.fileId)).status).toBe(204);

    const handedIn = await readyFile(guardian, proof);
    const refused = await withdraw(guardian, handedIn);
    expect(refused.status).toBe(409);
    expect(refused.error?.message).toBe(
      'This file has been handed in and can no longer be withdrawn',
    );
    // It is still theirs to open.
    expect((await link(guardian, handedIn)).status).toBe(200);
  });
});
