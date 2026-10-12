import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CalendarRange } from '@takhti/contracts';
import {
  registerCalendarSource,
  removeCalendarSource,
  roomsDb,
  type Actor,
  type CalendarEntryInput,
} from '@takhti/core';
import * as calendarRoute from '../../../apps/web/app/api/v1/calendar/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, type TestOrg } from '../../helpers/world';

/*
 * The calendar read model, with sources registered for these tests.
 * Rules and failure cases: docs/plan/10-modules/m39-notices-events-calendar.md.
 */

let db: TestDb;
let school: TestOrg;
let withoutTransport: TestOrg;
let principal: Actor;
let guardian: Actor;

const day = (date: string, title: string, kind = 'holiday'): CalendarEntryInput => ({
  kind,
  title,
  start: date,
  end: date,
  allDay: true,
});

const read = (actor: Actor | undefined, from: string, to: string) =>
  callRoute<CalendarRange>(calendarRoute.GET, {
    ...(actor && { as: actor }),
    url: `/api/v1/calendar?from=${from}&to=${to}`,
  });

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  withoutTransport = await seedOrg({ modules: [] });
  principal = await school.actor('principal');
  // The child first, so that the guardian's access already names her when it is first read.
  await school.actor('student');
  guardian = await school.actor('guardian');

  registerCalendarSource({
    source: 'tests-holidays',
    module: 'setup',
    entries: async () => [
      day('2026-10-09', 'Before the range'),
      day('2026-10-12', 'Iqbal Day'),
      { ...day('2026-10-14', 'Autumn break'), end: '2026-10-16' },
      day('2026-11-20', 'After the range'),
    ],
  });
  // What a person sees depends on who they are: each source reads through the caller's own ctx.
  registerCalendarSource({
    source: 'tests-own',
    module: 'notices',
    entries: async (ctx) => {
      if (ctx.actor.kind === 'guardian')
        return ctx.actor.studentIds.map((studentId) => ({
          ...day('2026-10-12', 'Fee due', 'fee-due'),
          link: '/family/fees',
          studentId,
        }));
      // Staff: one entry for each room they can see, which proves the query ran as them.
      const visible = await roomsDb.count(ctx);
      return [
        {
          kind: 'duty',
          title: `Invigilation (${visible} rooms)`,
          start: '2026-10-12T04:00:00.000Z',
          end: '2026-10-12T06:00:00.000Z',
          allDay: false,
        },
      ];
    },
  });
  registerCalendarSource({
    source: 'tests-transport',
    module: 'transport',
    entries: async () => [day('2026-10-12', 'Route change', 'route')],
  });
});
afterAll(async () => {
  for (const source of ['tests-holidays', 'tests-own', 'tests-transport', 'tests-broken', 'tests-bad'])
    removeCalendarSource(source);
  await db.destroy();
});

describe('GET /calendar', () => {
  it('gathers every source for the range, oldest first, all-day entries before timed ones on a day', async () => {
    const response = await read(principal, '2026-10-10', '2026-10-15');
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ from: '2026-10-10', to: '2026-10-15', unavailable: [] });
    expect(response.data.entries.map((entry) => [entry.source, entry.title])).toEqual([
      ['tests-holidays', 'Iqbal Day'],
      ['tests-transport', 'Route change'],
      ['tests-own', 'Invigilation (0 rooms)'],
      // It starts inside the range and runs past its end.
      ['tests-holidays', 'Autumn break'],
    ]);
    expect(response.data.entries[0]).toEqual({
      source: 'tests-holidays',
      kind: 'holiday',
      title: 'Iqbal Day',
      start: '2026-10-12',
      end: '2026-10-12',
      allDay: true,
      link: null,
      studentId: null,
    });
  });

  it('an entry that only touches the range is shown; one wholly outside it is not', async () => {
    const response = await read(principal, '2026-10-16', '2026-10-31');
    expect(response.data.entries.map((entry) => entry.title)).toEqual(['Autumn break']);
  });

  it('R-notices-17 / T-notices-12 a guardian sees entries for their own children, each marked with the child', async () => {
    const response = await read(guardian, '2026-10-12', '2026-10-12');
    const own = response.data.entries.filter((entry) => entry.source === 'tests-own');
    expect(guardian.studentIds).toHaveLength(1);
    expect(own).toHaveLength(1);
    expect(own[0]).toMatchObject({
      kind: 'fee-due',
      link: '/family/fees',
      studentId: guardian.studentIds[0],
    });
    expect(response.data.entries.map((entry) => entry.title)).not.toContain(
      'Invigilation (0 rooms)',
    );
  });

  it('a module that is switched off for the school has no dates', async () => {
    const owner = await withoutTransport.actor('owner');
    const response = await read(owner, '2026-10-12', '2026-10-12');
    expect(response.data.entries.map((entry) => entry.source)).not.toContain('tests-transport');
    expect(response.data.entries.map((entry) => entry.source)).toContain('tests-holidays');
  });

  it('F-notices-8 / T-notices-12 a source that fails is named, and the calendar still shows the others', async () => {
    registerCalendarSource({
      source: 'tests-broken',
      module: 'exams',
      // A query the database refuses: without a savepoint this would spoil the whole request.
      entries: async (ctx) => {
        await ctx.db.execute(sql`select * from a_table_that_does_not_exist`);
        return [];
      },
    });
    registerCalendarSource({
      source: 'tests-bad',
      module: 'exams',
      entries: async () => [{ ...day('2026-10-12', 'x'), title: '' }],
    });
    const response = await read(principal, '2026-10-12', '2026-10-12');
    expect(response.status).toBe(200);
    expect(response.data.unavailable).toEqual(['tests-bad', 'tests-broken']);
    // The sources read after the broken one are there too.
    expect(response.data.entries.map((entry) => entry.source).sort()).toEqual([
      'tests-holidays',
      'tests-own',
      'tests-transport',
    ]);
    removeCalendarSource('tests-broken');
    removeCalendarSource('tests-bad');
  });

  it('a range that runs backwards, is too long, or is not made of dates is refused under its field', async () => {
    const backwards = await read(principal, '2026-10-12', '2026-10-11');
    expect(backwards.status).toBe(422);
    expect(backwards.error?.fields).toHaveProperty('to');
    expect((await read(principal, '2026-01-01', '2027-02-05')).status).toBe(422);
    expect((await read(principal, '2026-01-01', '2027-02-04')).status).toBe(200);
    expect((await read(principal, '2026-02-30', '2026-03-01')).status).toBe(422);
    expect((await read(undefined, '2026-10-12', '2026-10-12')).status).toBe(401);
  });
});
