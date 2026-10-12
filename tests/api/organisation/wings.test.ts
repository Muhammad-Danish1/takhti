import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Page, Wing } from '@takhti/contracts';
import type { Actor } from '@takhti/core';
import { adminDb, branches, wings } from '@takhti/db';
import * as item from '../../../apps/web/app/api/v1/wings/[id]/route';
import * as collection from '../../../apps/web/app/api/v1/wings/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, type TestOrg } from '../../helpers/world';

/* Wings. Rules: docs/plan/10-modules/m02-organisation-branches.md, rule R-org-9. */

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let principal: Actor;
let cityPrincipal: Actor;
let teacher: Actor;
let guardian: Actor;
let outsider: Actor;

const add = (actor: Actor, body: Record<string, unknown>) =>
  callRoute<Wing>(collection.POST, {
    as: actor,
    method: 'POST',
    url: '/api/v1/wings',
    body: { branchId: school.mainBranchId, ...body },
  });
const list = (actor: Actor, query = '') =>
  callRoute<Page<Wing>>(collection.GET, { as: actor, url: `/api/v1/wings${query}` });
const change = (actor: Actor, id: string, body: unknown) =>
  callRoute<Wing>(item.PATCH, { as: actor, method: 'PATCH', url: '/x', params: { id }, body });
const remove = (actor: Actor, id: string) =>
  callRoute(item.DELETE, { as: actor, method: 'DELETE', url: '/x', params: { id } });

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  principal = await school.actor('principal');
  cityPrincipal = await school.actor('principal', { branch: 'city' });
  teacher = await school.actor('class_teacher');
  guardian = await school.actor('guardian');
  outsider = await other.actor('principal');
});
afterAll(async () => {
  await db.destroy();
});

describe('wings', () => {
  let primary: Wing;

  it('an administrator of the branch adds, changes and deletes its wings; all staff see them, lowest grades first', async () => {
    const middle = await add(principal, { name: 'Middle', gradeFrom: 6, gradeTo: 8 });
    expect(middle.status).toBe(201);
    const made = await add(principal, {
      name: '  Primary ',
      nameUr: 'پرائمری',
      gradeFrom: 1,
      gradeTo: 5,
      headStaffId: principal.staffId,
    });
    expect(made.data).toMatchObject({
      branchId: school.mainBranchId,
      name: 'Primary',
      nameUr: 'پرائمری',
      gradeFrom: 1,
      gradeTo: 5,
      gender: 'mixed',
      headStaffId: principal.staffId,
      version: 1,
    });
    primary = made.data;

    const seen = await list(teacher, `?branchId=${school.mainBranchId}`);
    expect(seen.data.items.map((wing) => wing.name)).toEqual(['Primary', 'Middle']);

    const renamed = await change(principal, middle.data.id, { version: 1, name: 'Middle School' });
    expect(renamed.data).toMatchObject({ name: 'Middle School', gradeFrom: 6, gradeTo: 8, version: 2 });
    expect((await change(principal, middle.data.id, { version: 1, name: 'Stale' })).status).toBe(409);

    expect((await remove(principal, middle.data.id)).status).toBe(204);
    const [row] = await adminDb().select().from(wings).where(eq(wings.id, middle.data.id));
    expect(row?.deletedAt).not.toBeNull();
    expect((await list(teacher)).data.items.map((wing) => wing.name)).toEqual(['Primary']);
  });

  it('only those who may manage wings change them, and only at a branch they work at', async () => {
    expect((await add(teacher, { name: 'Senior', gradeFrom: 9, gradeTo: 10 })).status).toBe(403);
    expect((await change(teacher, primary.id, { version: 1, name: 'Mine' })).status).toBe(403);
    expect((await remove(teacher, primary.id)).status).toBe(403);
    expect((await list(guardian)).status).toBe(403);
    // The principal of City Campus cannot shape Main Campus, nor find its wing to change it.
    expect((await add(cityPrincipal, { name: 'Senior', gradeFrom: 9, gradeTo: 10 })).status).toBe(403);
    expect((await change(cityPrincipal, primary.id, { version: 1, name: 'Mine' })).status).toBe(404);
    // Another school sees none of it.
    expect((await list(outsider)).data.items).toEqual([]);
    expect((await change(outsider, primary.id, { version: 1, name: 'Mine' })).status).toBe(404);
    expect((await add(outsider, { name: 'Senior', gradeFrom: 9, gradeTo: 10 })).status).toBe(403);
  });

  it('a wing’s name is its own within the branch, and its last grade is not before its first', async () => {
    const twice = await add(principal, { name: 'primary', gradeFrom: 9, gradeTo: 10 });
    // Names differ by more than capitals here, so this one is allowed; the same name is not.
    expect(twice.status).toBe(201);
    await remove(principal, twice.data.id);
    const same = await add(principal, { name: 'Primary', gradeFrom: 9, gradeTo: 10 });
    expect(same.status).toBe(409);
    expect(same.error?.fields).toEqual({ name: ['This branch already has a wing with this name'] });

    const backwards = await add(principal, { name: 'Senior', gradeFrom: 10, gradeTo: 9 });
    expect(backwards.status).toBe(422);
    expect(backwards.error?.fields).toEqual({ gradeTo: ['The last grade cannot be before the first'] });
    expect((await add(principal, { name: 'Senior', gradeFrom: 0, gradeTo: 11 })).status).toBe(422);
    // A change that sends only one end is checked against the other end as it stands.
    const shrunk = await change(principal, primary.id, { version: 1, gradeFrom: 6 });
    expect(shrunk.status).toBe(422);
    expect(shrunk.error?.fields).toEqual({ gradeTo: ['The last grade cannot be before the first'] });
  });

  it('T-org-6 / R-org-9 two wings of a branch do not share a grade', async () => {
    const overlapping = await add(principal, { name: 'Middle', gradeFrom: 5, gradeTo: 8 });
    expect(overlapping.status).toBe(409);
    expect(overlapping.error).toMatchObject({
      code: 'RULE',
      message:
        "These grades overlap the wing Primary (Grades 1 to 5). Only a boys' wing and a girls' wing may share grades.",
    });
    expect((await add(principal, { name: 'Whole school', gradeFrom: 1, gradeTo: 10 })).status).toBe(409);
    const middle = await add(principal, { name: 'Middle', gradeFrom: 6, gradeTo: 8 });
    expect(middle.status).toBe(201);

    // Changing a wing is checked the same way, against the others and not against itself.
    expect((await change(principal, middle.data.id, { version: 1, gradeFrom: 4 })).status).toBe(409);
    expect((await change(principal, middle.data.id, { version: 1, gradeTo: 7 })).status).toBe(200);
    expect((await change(principal, primary.id, { version: 1, nameUr: null })).status).toBe(200);

    // Another branch has its own wings: the same grades there are no overlap.
    const cityPrimary = await callRoute<Wing>(collection.POST, {
      as: cityPrincipal,
      method: 'POST',
      url: '/api/v1/wings',
      body: { branchId: school.cityBranchId, name: 'Primary', gradeFrom: 1, gradeTo: 5 },
    });
    expect(cityPrimary.status).toBe(201);
  });

  it('T-org-6 / R-org-9 a boys’ wing and a girls’ wing may cover the same grades, and no other pair may', async () => {
    const boys = await add(principal, { name: 'Senior Boys', gradeFrom: 9, gradeTo: 10, gender: 'boys' });
    expect(boys.status).toBe(201);
    const girls = await add(principal, { name: 'Senior Girls', gradeFrom: 9, gradeTo: 10, gender: 'girls' });
    expect(girls.status).toBe(201);
    expect(girls.data.gender).toBe('girls');

    expect(
      (await add(principal, { name: 'More Boys', gradeFrom: 10, gradeTo: 10, gender: 'boys' })).status,
    ).toBe(409);
    expect((await add(principal, { name: 'Senior Mixed', gradeFrom: 9, gradeTo: 10 })).status).toBe(409);
    // Nor may one of the pair become mixed while the other stands.
    const mixed = await change(principal, girls.data.id, { version: 1, gender: 'mixed' });
    expect(mixed.status).toBe(409);
    expect(mixed.error?.message).toMatch(/overlap the wing Senior Boys/);
    expect((await list(teacher, '?gender=girls')).data.items.map((wing) => wing.name)).toEqual([
      'Senior Girls',
    ]);
  });

  it('R-org-6 the wings of an inactive branch are read-only', async () => {
    await adminDb().update(branches).set({ status: 'inactive' }).where(eq(branches.id, school.mainBranchId));
    try {
      expect((await add(principal, { name: 'Late', gradeFrom: 8, gradeTo: 8 })).status).toBe(409);
      expect((await change(principal, primary.id, { version: 2, name: 'Juniors' })).status).toBe(409);
      expect((await remove(principal, primary.id)).status).toBe(409);
      expect((await list(principal)).status).toBe(200);
    } finally {
      await adminDb().update(branches).set({ status: 'active' }).where(eq(branches.id, school.mainBranchId));
    }
  });
});
