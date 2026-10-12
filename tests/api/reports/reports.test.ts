import { randomUUID } from 'node:crypto';
import { and, eq, gte } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { ReportCatalogue, ReportResult, ReportSummary } from '@takhti/contracts';
import { defineReport, MAX_ROWS_ON_SCREEN, roomsDb, type Actor } from '@takhti/core';
import { adminDb, reportRuns, rooms } from '@takhti/db';
import * as library from '../../../apps/web/app/api/v1/reports/route';
import * as one from '../../../apps/web/app/api/v1/reports/[key]/route';
import * as run from '../../../apps/web/app/api/v1/reports/[key]/run/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * The report registry, through its routes, with reports registered for these tests over real rows.
 * Rules and tests: docs/plan/10-modules/m42-dashboards-reports.md.
 */

// A report every member of staff may run, over the rooms they can see.
defineReport({
  key: 'tests.rooms',
  module: 'organisation',
  title: { en: 'Rooms and their capacity', ur: 'کمرے' },
  permission: 'rooms:read',
  params: z.object({
    branchIds: z.array(z.uuid()).optional(),
    minCapacity: z.int().min(0).default(0),
  }),
  columns: [
    { key: 'name', label: { en: 'Room', ur: 'کمرہ' }, type: 'text' },
    { key: 'kind', label: { en: 'Kind', ur: 'قسم' }, type: 'text' },
    { key: 'capacity', label: { en: 'Capacity', ur: 'گنجائش' }, type: 'count', total: 'sum' },
  ],
  run: async (ctx, params) => ({
    rows: (await roomsDb.all(ctx, gte(rooms.capacity, params.minCapacity)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((room) => ({ name: room.name, kind: room.kind, capacity: room.capacity })),
  }),
  pdf: { orientation: 'portrait' },
});
// One that needs a permission few people hold.
defineReport({
  key: 'tests.for-leaders',
  module: 'organisation',
  title: { en: 'For leaders', ur: 'x' },
  permission: 'branches:create',
  params: z.object({}),
  columns: [{ key: 'name', label: { en: 'Name', ur: 'x' }, type: 'text' }],
  run: () => ({ rows: [{ name: 'Only for those who may add a branch' }] }),
});
// One that is too long for a screen, and one that works out its own totals.
defineReport({
  key: 'tests.long',
  module: 'organisation',
  title: { en: 'Long', ur: 'x' },
  permission: 'rooms:read',
  params: z.object({ rows: z.int() }),
  columns: [{ key: 'n', label: { en: 'N', ur: 'x' }, type: 'number', total: 'sum' }],
  run: (_ctx, params) => ({ rows: Array.from({ length: params.rows }, (_value, n) => ({ n })) }),
});
defineReport({
  key: 'tests.own-totals',
  module: 'organisation',
  title: { en: 'Own totals', ur: 'x' },
  permission: 'rooms:read',
  params: z.object({}),
  columns: [{ key: 'rate', label: { en: 'Rate', ur: 'x' }, type: 'percent' }],
  run: () => ({ rows: [{ rate: 90 }, { rate: 50 }], totals: { rate: 83.33 } }),
});

let db: TestDb;
let school: TestOrg;
let principal: Actor;
let cityPrincipal: Actor;
let director: Actor;
let teacher: Actor;
let guardian: Actor;

const runReport = (actor: Actor | undefined, key: string, body: unknown = {}) =>
  callRoute<ReportResult>(run.POST, {
    ...(actor && { as: actor }),
    method: 'POST',
    url: `/api/v1/reports/${key}/run`,
    params: { key },
    body,
  });

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  principal = await school.actor('principal');
  cityPrincipal = await school.actor('principal', { branch: 'city' });
  director = await school.actor('director');
  teacher = await school.actor('class_teacher');
  guardian = await school.actor('guardian');
  const room = (branchId: string, name: string, kind: 'classroom' | 'lab', capacity: number) => ({
    id: randomUUID(),
    orgId: school.orgId,
    createdAt: TEST_NOW,
    updatedAt: TEST_NOW,
    branchId,
    name,
    kind,
    capacity,
  });
  await adminDb()
    .insert(rooms)
    .values([
      room(school.mainBranchId, 'Room 1', 'classroom', 30),
      room(school.mainBranchId, 'Room 2', 'classroom', 35),
      room(school.mainBranchId, 'Physics lab', 'lab', 24),
      room(school.cityBranchId, 'City room 1', 'classroom', 40),
      room(school.cityBranchId, 'City room 2', 'classroom', 28),
    ]);
});
afterAll(async () => {
  await db.destroy();
});

describe('the report library', () => {
  it('lists the reports a person may run, grouped by module, each with the schema of its filters', async () => {
    const response = await callRoute<ReportCatalogue>(library.GET, {
      as: teacher,
      url: '/api/v1/reports',
    });
    expect(response.status).toBe(200);
    const mine = response.data.find((group) => group.module === 'organisation')?.reports ?? [];
    const keys = mine.map((report) => report.key);
    expect(keys).toContain('tests.rooms');
    // R-reports-1: a report whose own permission the person lacks is not offered to them.
    expect(keys).not.toContain('tests.for-leaders');
    expect([...keys].sort()).toEqual(keys);

    const roomsReport = mine.find((report) => report.key === 'tests.rooms');
    expect(roomsReport).toMatchObject({
      title: { en: 'Rooms and their capacity' },
      permission: 'rooms:read',
      pdf: { orientation: 'portrait' },
    });
    expect(roomsReport?.columns.map((column) => column.key)).toEqual(['name', 'kind', 'capacity']);
    expect(roomsReport?.paramsSchema).toMatchObject({
      type: 'object',
      properties: { minCapacity: { type: 'integer', minimum: 0, default: 0 } },
    });

    const forDirector = await callRoute<ReportCatalogue>(library.GET, {
      as: director,
      url: '/api/v1/reports',
    });
    expect(forDirector.data.flatMap((group) => group.reports.map((report) => report.key))).toContain(
      'tests.for-leaders',
    );
  });

  it('one report by its key; one the person may not run is, to them, not there', async () => {
    const read = (actor: Actor, key: string) =>
      callRoute<ReportSummary>(one.GET, { as: actor, url: `/api/v1/reports/${key}`, params: { key } });
    expect((await read(teacher, 'tests.rooms')).data.key).toBe('tests.rooms');
    expect((await read(teacher, 'tests.for-leaders')).status).toBe(404);
    expect((await read(teacher, 'tests.nothing')).status).toBe(404);
    expect((await read(teacher, 'Not A Key')).status).toBe(422);
  });

  it('a family has no report library', async () => {
    expect((await callRoute(library.GET, { as: guardian, url: '/api/v1/reports' })).status).toBe(403);
    expect((await runReport(guardian, 'tests.rooms')).status).toBe(403);
    expect((await runReport(undefined, 'tests.rooms')).status).toBe(401);
  });
});

describe('running a report', () => {
  it('returns the rows with the report’s columns, and the parameters as it understood them', async () => {
    const response = await runReport(principal, 'tests.rooms');
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      key: 'tests.rooms',
      page: 1,
      pageSize: 100,
      total: 3,
      params: { minCapacity: 0 },
      totals: { capacity: 89 },
    });
    expect(response.data.rows).toEqual([
      { name: 'Physics lab', kind: 'lab', capacity: 24 },
      { name: 'Room 1', kind: 'classroom', capacity: 30 },
      { name: 'Room 2', kind: 'classroom', capacity: 35 },
    ]);
    expect(response.data.columns.map((column) => column.key)).toEqual(['name', 'kind', 'capacity']);
  });

  it('R-reports-4 the totals are of every matching row, not of the page on screen', async () => {
    const second = await runReport(principal, 'tests.rooms', { page: 2, pageSize: 2 });
    expect(second.data.rows).toEqual([{ name: 'Room 2', kind: 'classroom', capacity: 35 }]);
    expect(second.data).toMatchObject({ total: 3, page: 2, pageSize: 2, totals: { capacity: 89 } });
    // A report that works out its own totals (a rate cannot be summed) is taken at its word.
    expect((await runReport(principal, 'tests.own-totals')).data.totals).toEqual({ rate: 83.33 });
  });

  it('R-reports-1 / T-reports-2 a campus user’s report holds no row of another branch; the group sees them all', async () => {
    const city = await runReport(cityPrincipal, 'tests.rooms');
    expect(city.data.rows.map((row) => row.name)).toEqual(['City room 1', 'City room 2']);
    expect(city.data.totals).toEqual({ capacity: 68 });
    const group = await runReport(director, 'tests.rooms');
    expect(group.data.total).toBe(5);
    expect(group.data.totals).toEqual({ capacity: 157 });
  });

  it('R-reports-1 a person without the report’s own permission is refused, whatever else they hold', async () => {
    expect((await runReport(teacher, 'tests.for-leaders')).status).toBe(403);
    expect((await runReport(director, 'tests.for-leaders')).status).toBe(200);
  });

  it('T-reports-1 parameters the report does not accept are refused, under the field at fault', async () => {
    const response = await runReport(principal, 'tests.rooms', { params: { minCapacity: -1 } });
    expect(response.status).toBe(422);
    expect(response.error?.fields).toHaveProperty('minCapacity');
    expect((await runReport(principal, 'tests.nothing')).status).toBe(404);
  });

  it('its filters narrow it', async () => {
    const response = await runReport(principal, 'tests.rooms', { params: { minCapacity: 30 } });
    expect(response.data.rows.map((row) => row.name)).toEqual(['Room 1', 'Room 2']);
    expect(response.data.totals).toEqual({ capacity: 65 });
  });

  it('R-reports-14 / T-reports-10 a report too long for a screen is refused with its size, never cut short', async () => {
    const fits = await runReport(principal, 'tests.long', { params: { rows: MAX_ROWS_ON_SCREEN } });
    expect(fits.status).toBe(200);
    expect(fits.data.total).toBe(MAX_ROWS_ON_SCREEN);
    const tooLong = await runReport(principal, 'tests.long', {
      params: { rows: MAX_ROWS_ON_SCREEN + 1 },
    });
    expect(tooLong.status).toBe(409);
    expect(tooLong.error).toMatchObject({
      code: 'RULE',
      message:
        'This report has 5,001 rows, more than the 5,000 a screen shows. Narrow the filters, or export it.',
    });
  });

  it('R-reports-3 / T-reports-11 every run is recorded: who, which report, with what, how many rows', async () => {
    await runReport(cityPrincipal, 'tests.rooms', {
      params: { branchIds: [school.cityBranchId], minCapacity: 30 },
    });
    const runs = await adminDb()
      .select()
      .from(reportRuns)
      .where(and(eq(reportRuns.orgId, school.orgId), eq(reportRuns.userId, cityPrincipal.userId)));
    expect(runs.length).toBeGreaterThan(0);
    for (const entry of runs)
      expect(entry).toMatchObject({ reportKey: 'tests.rooms', output: 'screen', status: 'ok' });
    const withBranch = runs.find((entry) => entry.branchIds.length === 1);
    expect(withBranch).toMatchObject({
      branchIds: [school.cityBranchId],
      params: { branchIds: [school.cityBranchId], minCapacity: 30 },
      rowCount: 1,
    });
    expect(withBranch?.durationMs).toBeGreaterThanOrEqual(0);

    // A run that was refused wrote nothing.
    const refused = await adminDb()
      .select()
      .from(reportRuns)
      .where(and(eq(reportRuns.orgId, school.orgId), eq(reportRuns.userId, teacher.userId)));
    expect(refused.map((entry) => entry.reportKey)).not.toContain('tests.for-leaders');
  });
});
