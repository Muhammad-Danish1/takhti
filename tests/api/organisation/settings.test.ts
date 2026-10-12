import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { defineSetting, registerSettingForTests, type SettingView } from '@takhti/contracts';
import type { Actor } from '@takhti/core';
import { adminDb, branches, domainEvents } from '@takhti/db';
import * as branchItem from '../../../apps/web/app/api/v1/branches/[id]/settings/[key]/route';
import * as branchList from '../../../apps/web/app/api/v1/branches/[id]/settings/route';
import * as one from '../../../apps/web/app/api/v1/org/settings/[key]/route';
import * as all from '../../../apps/web/app/api/v1/org/settings/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, type TestOrg } from '../../helpers/world';

/*
 * Settings through the API. Rules and failure cases: docs/plan/10-modules/m02-organisation-branches.md.
 * How a value is stored and resolved is proved in tests/api/kernel/numbers-idempotency-limits.test.ts.
 */

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let director: Actor;
let principal: Actor;
let cityPrincipal: Actor;
let itAdmin: Actor;
let coordinator: Actor;
let teacher: Actor;
let guardian: Actor;
let outsider: Actor;
let forget: () => void;

const WEEK = 'general.working_week';
const fiveDays = { workingDays: [1, 2, 3, 4, 5], shortDay: 5 };
const sixDays = { workingDays: [1, 2, 3, 4, 5, 6], shortDay: 5 };

/** A setting as a module would declare one of its own: its own permission to change, its own to read. */
const lateFine = defineSetting({
  key: 'tests.late_fine',
  scope: 'branch',
  schema: z.object({ perDay: z.int().min(0), cap: z.int().min(0) }),
  default: { perDay: 0, cap: 0 },
  label: 'Late fine',
  permission: 'jobs:retry',
  readableBy: 'jobs:read',
});

const get = (actor: Actor, key: string, query = '') =>
  callRoute<SettingView>(one.GET, {
    as: actor,
    url: `/api/v1/org/settings/${key}${query}`,
    params: { key },
  });
const put = (actor: Actor, key: string, value: unknown) =>
  callRoute<SettingView>(one.PUT, {
    as: actor,
    method: 'PUT',
    url: `/api/v1/org/settings/${key}`,
    params: { key },
    body: { value },
  });
const putAt = (actor: Actor, branchId: string, key: string, value: unknown) =>
  callRoute<SettingView>(branchItem.PUT, {
    as: actor,
    method: 'PUT',
    url: '/x',
    params: { id: branchId, key },
    body: { value },
  });
const clearAt = (actor: Actor, branchId: string, key: string) =>
  callRoute<SettingView>(branchItem.DELETE, {
    as: actor,
    method: 'DELETE',
    url: '/x',
    params: { id: branchId, key },
  });

beforeAll(async () => {
  db = await createTestDb();
  forget = registerSettingForTests(lateFine as never);
  school = await seedOrg();
  other = await seedOrg();
  director = await school.actor('director');
  principal = await school.actor('principal');
  cityPrincipal = await school.actor('principal', { branch: 'city' });
  itAdmin = await school.actor('it_admin');
  coordinator = await school.actor('coordinator');
  teacher = await school.actor('class_teacher');
  guardian = await school.actor('guardian');
  outsider = await other.actor('principal');
});
afterAll(async () => {
  forget();
  await db.destroy();
});

describe('settings', () => {
  it('those who may see settings get every one, with its value, its default and whether they may change it', async () => {
    const listed = await callRoute<SettingView[]>(all.GET, { as: principal, url: '/api/v1/org/settings' });
    expect(listed.status).toBe(200);
    expect(listed.data.map((setting) => setting.key)).toEqual(
      expect.arrayContaining([
        'general.languages',
        'general.number_formats',
        WEEK,
        'security.password_policy',
        'security.mfa_roles',
        'security.session_hours',
        'documents.letterhead',
        'documents.signatures',
      ]),
    );
    const week = listed.data.find((setting) => setting.key === WEEK);
    expect(week).toEqual({
      key: WEEK,
      scope: 'branch',
      label: 'Working week',
      value: sixDays,
      defaultValue: sixDays,
      source: 'default',
      canChange: true,
    });
    // Someone who may look but not change is told so, setting by setting.
    const forIt = await callRoute<SettingView[]>(all.GET, { as: itAdmin, url: '/api/v1/org/settings' });
    expect(forIt.data.find((setting) => setting.key === WEEK)?.canChange).toBe(false);
    expect(forIt.data.find((setting) => setting.key === lateFine.key)?.canChange).toBe(true);
    expect((await callRoute(all.GET, { as: teacher, url: '/api/v1/org/settings' })).status).toBe(403);
    expect((await callRoute(all.GET, { as: guardian, url: '/api/v1/org/settings' })).status).toBe(403);
  });

  it('T-org-1 / R-org-2 the branch’s value wins, then the group’s, then the default', async () => {
    expect((await get(teacher, WEEK)).data).toMatchObject({ value: sixDays, source: 'default' });

    const saved = await put(principal, WEEK, { workingDays: [1, 2, 3, 4, 5], shortDay: null });
    expect(saved.status).toBe(200);
    expect(saved.data).toMatchObject({ source: 'org', value: { workingDays: [1, 2, 3, 4, 5], shortDay: null } });

    const own = await putAt(principal, school.mainBranchId, WEEK, fiveDays);
    expect(own.data).toMatchObject({ source: 'branch', value: fiveDays });
    expect((await get(teacher, WEEK, `?branchId=${school.mainBranchId}`)).data).toMatchObject({
      source: 'branch',
      value: fiveDays,
    });
    // The other branch, and a question that names no branch, get the group's value.
    expect((await get(director, WEEK, `?branchId=${school.cityBranchId}`)).data.source).toBe('org');
    expect((await get(teacher, WEEK)).data.source).toBe('org');
    // Staff are told a branch's own values only at a branch they work at.
    expect((await get(teacher, WEEK, `?branchId=${school.cityBranchId}`)).status).toBe(403);

    const cleared = await clearAt(principal, school.mainBranchId, WEEK);
    expect(cleared.status).toBe(200);
    expect(cleared.data).toMatchObject({ source: 'org', value: { workingDays: [1, 2, 3, 4, 5], shortDay: null } });
    // Clearing what is not there changes nothing.
    expect((await clearAt(principal, school.mainBranchId, WEEK)).data.source).toBe('org');

    const told = await adminDb()
      .select()
      .from(domainEvents)
      .where(and(eq(domainEvents.orgId, school.orgId), eq(domainEvents.name, 'org.settings-changed')));
    expect(told.map((event) => (event.payload as { branchId: string | null }).branchId)).toEqual(
      expect.arrayContaining([null, school.mainBranchId]),
    );
    expect(told).toHaveLength(3);
  });

  it('T-org-1 / R-org-2 a setting that is the group’s alone cannot be given a branch value', async () => {
    const refused = await putAt(principal, school.mainBranchId, 'general.languages', ['ur']);
    expect(refused.status).toBe(409);
    expect(refused.error?.message).toBe(
      '"Languages offered" is set for the whole school group, not per branch',
    );
    expect((await clearAt(principal, school.mainBranchId, 'general.languages')).status).toBe(409);
    // Asked about at a branch, it simply answers with the group's value.
    expect((await get(teacher, 'general.languages', `?branchId=${school.mainBranchId}`)).data).toMatchObject({
      source: 'default',
      value: ['en', 'ur'],
    });
  });

  it('F-org-1 a value that does not fit the setting is refused, naming the field inside it', async () => {
    const wrong = await put(principal, 'security.password_policy', {
      minLength: 4,
      requireNumber: true,
      requireSymbol: false,
    });
    expect(wrong.status).toBe(422);
    expect(wrong.error?.code).toBe('VALIDATION');
    expect(wrong.error?.fields?.value?.[0]).toMatch(/^minLength: /);
    expect((await put(principal, WEEK, { workingDays: [] })).status).toBe(422);
    expect((await get(principal, 'security.password_policy')).data.source).toBe('default');
  });

  it('F-org-2 / R-org-1 a key that is not registered is not a setting, to read or to write', async () => {
    expect((await get(principal, 'general.no_such_thing')).status).toBe(404);
    expect((await put(principal, 'general.no_such_thing', true)).status).toBe(404);
    expect((await putAt(principal, school.mainBranchId, 'fees.invented', 1)).status).toBe(404);
    // Something that is not even shaped like a key never reaches the service.
    expect((await get(principal, 'DROP TABLE')).status).toBe(422);
  });

  it('T-org-2 a general setting is changed by those who may change settings, at the group or at their own branch', async () => {
    expect((await put(coordinator, WEEK, fiveDays)).status).toBe(403);
    expect((await put(teacher, 'general.languages', ['ur'])).status).toBe(403);
    expect((await put(director, 'general.languages', ['ur', 'en'])).status).toBe(200);

    // A branch's own value: an administrator of that branch, and of no other.
    expect((await putAt(teacher, school.mainBranchId, WEEK, fiveDays)).status).toBe(403);
    expect((await putAt(cityPrincipal, school.mainBranchId, WEEK, fiveDays)).status).toBe(403);
    expect((await putAt(cityPrincipal, school.cityBranchId, WEEK, fiveDays)).status).toBe(200);
    expect((await clearAt(principal, school.cityBranchId, WEEK)).status).toBe(403);
    // The director sees every branch, and changes the group's value, not a branch's own.
    expect((await get(director, WEEK, `?branchId=${school.cityBranchId}`)).data).toMatchObject({
      source: 'branch',
      canChange: false,
    });
    expect((await get(director, WEEK)).data.canChange).toBe(true);
    expect((await get(cityPrincipal, WEEK, `?branchId=${school.cityBranchId}`)).data.canChange).toBe(true);
  });

  it('T-org-2 a module’s setting is changed and read by those who hold that setting’s own permission', async () => {
    const fine = { perDay: 5_000, cap: 100_000 };
    // The director may change general settings, but this one is not general.
    expect((await put(director, lateFine.key, fine)).status).toBe(403);
    expect((await putAt(director, school.mainBranchId, lateFine.key, fine)).status).toBe(403);
    const saved = await put(itAdmin, lateFine.key, fine);
    expect(saved.data).toMatchObject({ value: fine, source: 'org', canChange: true });
    expect((await putAt(itAdmin, school.mainBranchId, lateFine.key, { perDay: 0, cap: 0 })).status).toBe(200);

    expect((await get(teacher, lateFine.key)).status).toBe(403);
    expect((await get(guardian, lateFine.key)).status).toBe(403);
    expect((await get(principal, lateFine.key)).data).toMatchObject({ value: fine, canChange: true });
  });

  it('T-org-8 a family reads the settings that shape its screens, and no other; it changes none', async () => {
    expect((await get(guardian, 'general.languages')).data).toMatchObject({
      value: ['ur', 'en'],
      canChange: false,
    });
    expect((await get(guardian, 'security.password_policy')).status).toBe(200);
    expect((await get(guardian, 'general.number_formats')).status).toBe(403);
    expect((await get(guardian, 'security.mfa_roles')).status).toBe(403);
    expect((await put(guardian, 'general.languages', ['en'])).status).toBe(403);
    expect((await putAt(guardian, school.mainBranchId, WEEK, fiveDays)).status).toBe(403);
    // A setting kept for those who manage settings is not shown to every member of staff either.
    expect((await get(teacher, 'security.mfa_roles')).status).toBe(403);
    expect((await get(itAdmin, 'security.mfa_roles')).status).toBe(200);
  });

  it('a branch’s settings are those it may have of its own, each with the value in force there', async () => {
    const listed = await callRoute<SettingView[]>(branchList.GET, {
      as: director,
      url: '/x',
      params: { id: school.cityBranchId },
    });
    expect(listed.status).toBe(200);
    expect(listed.data.every((setting) => setting.scope === 'branch')).toBe(true);
    expect(listed.data.map((setting) => setting.key)).toEqual(
      expect.arrayContaining([WEEK, 'documents.letterhead']),
    );
    // A setting kept for the holders of its own permission is left out for anyone else.
    expect(listed.data.map((setting) => setting.key)).not.toContain(lateFine.key);
    expect(listed.data.find((setting) => setting.key === WEEK)).toMatchObject({
      source: 'branch',
      value: fiveDays,
      canChange: false,
    });
    // The principal of Main Campus is not shown City Campus's own values.
    expect(
      (await callRoute(branchList.GET, { as: principal, url: '/x', params: { id: school.cityBranchId } })).status,
    ).toBe(403);
    expect(
      (await callRoute(branchList.GET, { as: teacher, url: '/x', params: { id: school.cityBranchId } })).status,
    ).toBe(403);
    expect(
      (await callRoute(branchList.GET, { as: outsider, url: '/x', params: { id: school.cityBranchId } })).status,
    ).toBe(404);
  });

  it('R-org-6 an inactive branch keeps its settings as they are', async () => {
    await adminDb().update(branches).set({ status: 'inactive' }).where(eq(branches.id, school.cityBranchId));
    const refused = await putAt(cityPrincipal, school.cityBranchId, WEEK, sixDays);
    expect(refused.status).toBe(409);
    expect(refused.error?.message).toMatch(/is inactive/);
    expect((await clearAt(cityPrincipal, school.cityBranchId, WEEK)).status).toBe(409);
    await adminDb().update(branches).set({ status: 'active' }).where(eq(branches.id, school.cityBranchId));
  });

  it('T-org-9 another school has its own settings, and sees none of this one’s', async () => {
    expect((await get(outsider, 'general.languages')).data).toMatchObject({
      value: ['en', 'ur'],
      source: 'default',
    });
    expect((await putAt(outsider, school.mainBranchId, WEEK, fiveDays)).status).toBe(403);
    expect((await get(outsider, WEEK, `?branchId=${school.cityBranchId}`)).status).toBe(403);
    expect((await get(outsider, WEEK)).data.source).toBe('default');
  });
});
