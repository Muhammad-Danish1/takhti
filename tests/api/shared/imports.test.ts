import { randomUUID } from 'node:crypto';
import { and, eq, ilike } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  Name,
  type CommittedImport,
  type ExportJob,
  type FileLink,
  type ImportBatch,
  type ImportRow,
  type Page,
  type UploadTicket,
} from '@takhti/contracts';
import {
  claimJobs,
  defineExporter,
  defineImporter,
  enqueue,
  exportBuildJob,
  memoryStorage,
  parseCsv,
  roomsDb,
  roomsService,
  runAsSystem,
  runClaimedJob,
  setStorageProvider,
  type Actor,
} from '@takhti/core';
import { adminDb, exportJobs, files, jobs, notifications, rooms } from '@takhti/db';
import * as exportItem from '../../../apps/web/app/api/v1/exports/[id]/route';
import * as exportList from '../../../apps/web/app/api/v1/exports/route';
import * as confirm from '../../../apps/web/app/api/v1/files/[id]/confirm/route';
import * as fileUrl from '../../../apps/web/app/api/v1/files/[id]/url/route';
import * as uploads from '../../../apps/web/app/api/v1/files/uploads/route';
import * as cancelRoute from '../../../apps/web/app/api/v1/imports/[id]/cancel/route';
import * as commitRoute from '../../../apps/web/app/api/v1/imports/[id]/commit/route';
import * as importItem from '../../../apps/web/app/api/v1/imports/[id]/route';
import * as rowsRoute from '../../../apps/web/app/api/v1/imports/[id]/rows/route';
import * as importList from '../../../apps/web/app/api/v1/imports/route';
import * as templateRoute from '../../../apps/web/app/api/v1/imports/templates/[kind]/route';
import { callRoute, callRouteRaw } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * Imports and exports through their routes, with an importer and an exporter registered for these
 * tests over a real service.
 * Rules, failure cases and tests: docs/plan/10-modules/m00-shared-kernel.md.
 */

let db: TestDb;
let school: TestOrg;
let principal: Actor;
let coordinator: Actor;
let itAdmin: Actor;
let teacher: Actor;
const store = memoryStorage();
const KIND = 'route-rooms';

defineImporter({
  kind: KIND,
  label: 'room',
  module: 'organisation',
  permission: { resource: 'rooms', action: 'update' },
  columns: [
    { key: 'name', header: 'Room Name', required: true, example: 'Room 12' },
    { key: 'capacity', header: 'Capacity', example: '40' },
  ],
  row: z.object({
    name: Name,
    capacity: z.union([
      z.literal('').transform(() => null),
      z.coerce.number().int().min(1, { error: 'Capacity must be at least 1' }),
    ]),
  }),
  commit: async (ctx, row, batch) =>
    (
      await roomsService.create(ctx, {
        branchId: batch.branchId as string,
        name: row.name,
        capacity: row.capacity,
      })
    ).id,
});
defineExporter({
  kind: KIND,
  label: 'room',
  permission: { resource: 'rooms', action: 'read' },
  filters: z.object({}),
  columns: [
    { header: 'Name', value: (room: { name: string; capacity: number | null }) => room.name },
    { header: 'Capacity', value: (room: { name: string; capacity: number | null }) => room.capacity },
  ],
  count: (ctx) => roomsDb.count(ctx),
  rows: async (ctx, _filters, page) =>
    (await roomsDb.all(ctx)).slice(page.offset, page.offset + page.limit),
});

/** Uploads a CSV the way a browser does: announce, send the bytes, confirm. */
async function uploadCsv(actor: Actor, text: string): Promise<string> {
  const ticket = await callRoute<UploadTicket>(uploads.POST, {
    as: actor,
    method: 'POST',
    url: '/api/v1/files/uploads',
    body: { purpose: 'import', fileName: 'rooms.csv', mimeType: 'text/csv', size: text.length },
  });
  const [file] = await adminDb().select().from(files).where(eq(files.id, ticket.data.fileId));
  await store.put(file!.bucket, file!.path, new TextEncoder().encode(text), 'text/csv');
  await callRoute(confirm.POST, {
    as: actor,
    method: 'POST',
    url: '/x',
    params: { id: ticket.data.fileId },
  });
  return ticket.data.fileId;
}

const start = (actor: Actor, body: unknown) =>
  callRoute<ImportBatch>(importList.POST, {
    as: actor,
    method: 'POST',
    url: '/api/v1/imports',
    body,
  });
const batch = (actor: Actor, id: string) =>
  callRoute<ImportBatch>(importItem.GET, { as: actor, url: `/api/v1/imports/${id}`, params: { id } });
const rowsOfBatch = (actor: Actor, id: string, query = '') =>
  callRoute<Page<ImportRow>>(rowsRoute.GET, {
    as: actor,
    url: `/api/v1/imports/${id}/rows${query}`,
    params: { id },
  });
const commit = (actor: Actor, id: string) =>
  callRoute<CommittedImport>(commitRoute.POST, {
    as: actor,
    method: 'POST',
    url: `/api/v1/imports/${id}/commit`,
    params: { id },
  });
const cancel = (actor: Actor, id: string) =>
  callRoute<ImportBatch>(cancelRoute.POST, {
    as: actor,
    method: 'POST',
    url: `/api/v1/imports/${id}/cancel`,
    params: { id },
  });

async function drain(): Promise<void> {
  for (let round = 0; round < 10; round++) {
    const claimed = await claimJobs({ workerId: 'test', limit: 50, perOrgLimit: 50 });
    if (claimed.length === 0) return;
    for (const job of claimed) await runClaimedJob(job);
  }
}
const importedRooms = () =>
  adminDb()
    .select()
    .from(rooms)
    .where(and(eq(rooms.orgId, school.orgId), ilike(rooms.name, 'Import %')));

const CSV =
  'room name,capacity,Ignored Column\r\nImport Lab,30,x\r\n,10,x\r\nImport Hall,zero,x\r\nImport Office,,x\r\nImport Lab,20,x\r\n';

beforeAll(async () => {
  db = await createTestDb();
  setStorageProvider(store);
  school = await seedOrg();
  principal = await school.actor('principal');
  coordinator = await school.actor('coordinator');
  itAdmin = await school.actor('it_admin');
  teacher = await school.actor('class_teacher');
});
afterAll(async () => {
  setStorageProvider(undefined);
  await db.destroy();
});
beforeEach(async () => {
  await adminDb().delete(jobs);
});

describe('T-shared-5 an import, from the template to the result', () => {
  it('the template is a spreadsheet with the headings and an example row', async () => {
    const response = await callRouteRaw(templateRoute.GET, {
      as: principal,
      url: `/api/v1/imports/templates/${KIND}`,
      params: { kind: KIND },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('content-disposition')).toBe(
      `attachment; filename="${KIND}-template.csv"`,
    );
    const text = await response.text();
    expect(parseCsv(text.replace(/^﻿/, ''))).toEqual([
      ['Room Name', 'Capacity'],
      ['Room 12', '40'],
    ]);
    // Needs the permission of what is imported; an unknown kind is not found.
    const refused = await callRouteRaw(templateRoute.GET, {
      as: teacher,
      url: '/x',
      params: { kind: KIND },
    });
    expect(refused.status).toBe(403);
    const unknown = await callRouteRaw(templateRoute.GET, {
      as: principal,
      url: '/x',
      params: { kind: 'no-such-import' },
    });
    expect(unknown.status).toBe(404);
  });

  it('checking shows the counts and what is wrong with each row, and writes no record', async () => {
    const fileId = await uploadCsv(principal, CSV);
    const started = await start(principal, { kind: KIND, fileId, branchId: school.mainBranchId });
    expect(started.status).toBe(201);
    expect(started.data).toMatchObject({
      kind: KIND,
      status: 'ready',
      totalRows: 5,
      validRows: 3,
      invalidRows: 2,
      createdRows: 0,
      errorFileId: null,
      startedBy: principal.userId,
      branchId: school.mainBranchId,
    });
    expect(await importedRooms()).toEqual([]);

    const wrong = await rowsOfBatch(principal, started.data.id, '?status=invalid');
    expect(wrong.data.total).toBe(2);
    expect(wrong.data.items.map((row) => [row.rowNumber, Object.keys(row.errors ?? {})])).toEqual([
      [3, ['Room Name']],
      [4, ['Capacity']],
    ]);
    expect(wrong.data.items[1]?.raw).toEqual({ name: 'Import Hall', capacity: 'zero' });
    const all = await rowsOfBatch(principal, started.data.id, '?pageSize=2&page=2');
    expect(all.data.items.map((row) => row.rowNumber)).toEqual([4, 5]);
    expect(all.data.total).toBe(5);
  });

  it('committing writes only the valid rows, keeps the rows that failed in a file to correct, and tells the person', async () => {
    const fileId = await uploadCsv(principal, CSV);
    const started = await start(principal, { kind: KIND, fileId, branchId: school.mainBranchId });
    const done = await commit(principal, started.data.id);
    expect(done.status).toBe(200);
    // Row 6 repeats the name of row 2: it fails alone, and the others are kept.
    expect(done.data).toMatchObject({ batchId: started.data.id, createdRows: 2, failedRows: 1 });
    expect((await importedRooms()).map((room) => room.name).sort()).toEqual([
      'Import Lab',
      'Import Office',
    ]);
    expect((await batch(principal, started.data.id)).data).toMatchObject({
      status: 'completed',
      createdRows: 2,
      errorFileId: done.data.errorFileId,
    });

    // The error file holds the two rows that were wrong and the one that failed, each with its reason.
    expect(done.data.errorFileId).not.toBeNull();
    const link = await callRoute<FileLink>(fileUrl.GET, {
      as: principal,
      url: '/x',
      params: { id: done.data.errorFileId! },
    });
    expect(link.status).toBe(200);
    const [errorFile] = await adminDb()
      .select()
      .from(files)
      .where(eq(files.id, done.data.errorFileId!));
    expect(errorFile).toMatchObject({ purpose: 'export', originalName: `${KIND}-rows-to-correct.csv` });
    const stored = await store.get(errorFile!.bucket, errorFile!.path);
    const problems = parseCsv(new TextDecoder().decode(stored!).replace(/^﻿/, ''));
    expect(problems[0]).toEqual(['Row', 'Room Name', 'Capacity', 'Problem']);
    expect(problems.slice(1).map((line) => line[0])).toEqual(['3', '4', '6']);
    expect(problems[3]?.[3]).toBe('This branch already has a room with this name');

    const failed = await rowsOfBatch(principal, started.data.id, '?status=failed');
    expect(failed.data.items.map((row) => row.rowNumber)).toEqual([6]);
    const created = await rowsOfBatch(principal, started.data.id, '?status=created');
    expect(created.data.items.every((row) => row.entityId !== null)).toBe(true);

    await drain();
    const bell = await adminDb()
      .select()
      .from(notifications)
      .where(eq(notifications.entityId, started.data.id));
    expect(bell).toHaveLength(1);
    expect(bell[0]).toMatchObject({
      userId: principal.userId,
      eventKey: 'import.completed',
      title: 'Import finished',
      body: '2 added, 1 could not be added.',
    });
  });

  it('R-shared-9 / F-shared-6 committing twice writes the rows once and answers with the first result', async () => {
    await adminDb().delete(rooms).where(ilike(rooms.name, 'Import %'));
    const fileId = await uploadCsv(principal, CSV);
    const started = await start(principal, { kind: KIND, fileId, branchId: school.mainBranchId });
    const first = await commit(principal, started.data.id);
    const second = await commit(principal, started.data.id);
    expect(second.status).toBe(200);
    expect(second.data).toEqual(first.data);
    expect(await importedRooms()).toHaveLength(2);
  });

  it('F-shared-5 a file with the wrong columns is refused when it is checked, naming what is missing', async () => {
    const fileId = await uploadCsv(principal, 'Capacity\r\n30\r\n');
    const refused = await start(principal, { kind: KIND, fileId });
    expect(refused.status).toBe(422);
    expect(refused.error?.fields).toEqual({
      fileId: ['The file is missing these columns: Room Name'],
    });
  });
});

describe('whose import it is', () => {
  it('an import is its starter’s; others cannot see, commit or cancel it, except those who may see every import', async () => {
    const fileId = await uploadCsv(principal, 'Room Name\r\nImport Private\r\n');
    const started = await start(principal, { kind: KIND, fileId, branchId: school.mainBranchId });
    const id = started.data.id;
    for (const response of [
      await batch(coordinator, id),
      await rowsOfBatch(coordinator, id),
      await commit(coordinator, id),
      await cancel(coordinator, id),
    ])
      expect(response.status).toBe(404);

    expect((await batch(itAdmin, id)).status).toBe(200);
    const listed = await callRoute<Page<ImportBatch>>(importList.GET, {
      as: itAdmin,
      url: `/api/v1/imports?kind=${KIND}&status=ready`,
    });
    expect(listed.data.items.map((item) => item.id)).toContain(id);
    expect(
      (await callRoute(importList.GET, { as: teacher, url: '/api/v1/imports' })).status,
    ).toBe(403);

    // Cancelled, it can no longer be committed.
    expect((await cancel(principal, id)).data.status).toBe('cancelled');
    expect((await commit(principal, id)).status).toBe(409);
    expect((await cancel(principal, id)).status).toBe(409);
  });

  it('starting an import needs the permission of what is imported', async () => {
    const fileId = await uploadCsv(teacher, 'Room Name\r\nImport Sneaky\r\n');
    expect((await start(teacher, { kind: KIND, fileId })).status).toBe(403);
    expect((await start(principal, { kind: 'no-such-import', fileId })).status).toBe(404);
  });
});

describe('exports', () => {
  it('F-shared-9 a large export is built by a job; its owner is told, sees it in their list and gets a link to the file', async () => {
    const exportId = randomUUID();
    await adminDb()
      .insert(exportJobs)
      .values({
        id: exportId,
        orgId: school.orgId,
        createdAt: TEST_NOW,
        updatedAt: TEST_NOW,
        userId: principal.userId,
        kind: KIND,
        filters: {},
        format: 'csv',
        status: 'queued',
      });
    const open = (actor: Actor) =>
      callRoute<ExportJob>(exportItem.GET, {
        as: actor,
        url: `/api/v1/exports/${exportId}`,
        params: { id: exportId },
      });
    const waiting = await open(principal);
    expect(waiting.data).toMatchObject({ status: 'queued', fileId: null });
    expect(waiting.data.download).toBeUndefined();

    await runAsSystem(school.orgId, {}, (ctx) => enqueue(ctx, exportBuildJob, { exportId }));
    await drain();

    const ready = await open(principal);
    expect(ready.data).toMatchObject({ status: 'ready', kind: KIND, format: 'csv' });
    expect(ready.data.rowCount).toBeGreaterThan(0);
    expect(ready.data.download?.url).toContain(ready.data.fileId as string);

    const mine = await callRoute<Page<ExportJob>>(exportList.GET, {
      as: principal,
      url: '/api/v1/exports?status=ready',
    });
    expect(mine.data.items.map((item) => item.id)).toEqual([exportId]);
    // An export is its owner's alone.
    expect((await open(itAdmin)).status).toBe(404);
    const theirs = await callRoute<Page<ExportJob>>(exportList.GET, {
      as: itAdmin,
      url: '/api/v1/exports',
    });
    expect(theirs.data.items).toEqual([]);

    const bell = await adminDb()
      .select()
      .from(notifications)
      .where(eq(notifications.entityId, exportId));
    expect(bell).toHaveLength(1);
    expect(bell[0]).toMatchObject({
      userId: principal.userId,
      eventKey: 'export.ready',
      title: 'Your export is ready',
    });
  });
});
