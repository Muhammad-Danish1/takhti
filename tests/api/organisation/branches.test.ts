import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Branch, Page } from '@takhti/contracts';
import { nextValue, registerBranchBlocker, type Actor } from '@takhti/core';
import { adminDb, auditLog, branches } from '@takhti/db';
import * as collection from '../../../apps/web/app/api/v1/branches/route';
import * as item from '../../../apps/web/app/api/v1/branches/[id]/route';
import * as activate from '../../../apps/web/app/api/v1/branches/[id]/activate/route';
import * as deactivate from '../../../apps/web/app/api/v1/branches/[id]/deactivate/route';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, seedOrg, type TestOrg } from '../../helpers/world';

/*
 * The first resource through all seven layers, and the pattern every later resource test follows.
 * Rules and failure cases: docs/plan/10-modules/m02-organisation-branches.md.
 */

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let director: Actor;
let principal: Actor;
let teacher: Actor;
let guardian: Actor;

const newBranch = (overrides: Record<string, unknown> = {}) => ({
  code: `B${Math.floor(Math.random() * 900 + 100)}`,
  name: 'Garden Town Campus',
  address: '7 Garden Block',
  city: 'Lahore',
  ...overrides,
});

const create = (actor: Actor, body: unknown) =>
  callRoute<Branch>(collection.POST, { as: actor, method: 'POST', url: '/api/v1/branches', body });
const list = (actor: Actor, query = '') =>
  callRoute<Page<Branch>>(collection.GET, { as: actor, url: `/api/v1/branches${query}` });
const read = (actor: Actor, id: string) =>
  callRoute<Branch>(item.GET, { as: actor, url: `/api/v1/branches/${id}`, params: { id } });
const patch = (actor: Actor, id: string, body: unknown) =>
  callRoute<Branch>(item.PATCH, {
    as: actor,
    method: 'PATCH',
    url: `/api/v1/branches/${id}`,
    params: { id },
    body,
  });
const setStatus = (route: typeof activate, actor: Actor, id: string, version: number) =>
  callRoute<Branch>(route.POST, {
    as: actor,
    method: 'POST',
    url: `/api/v1/branches/${id}/x`,
    params: { id },
    body: { version },
  });

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  director = await school.actor('director');
  principal = await school.actor('principal');
  teacher = await school.actor('subject_teacher');
  guardian = await school.actor('guardian');
});
afterAll(async () => {
  await db.destroy();
});

describe('branches: create, read, list, update', () => {
  it('creates a branch and returns it in the shape of the contract', async () => {
    const response = await create(
      director,
      newBranch({ code: 'GT', nameUr: 'گارڈن ٹاؤن کیمپس', phone: '042-35761234', capacity: 600 }),
    );
    expect(response.status).toBe(201);
    expect(response.data).toMatchObject({
      code: 'GT',
      name: 'Garden Town Campus',
      nameUr: 'گارڈن ٹاؤن کیمپس',
      city: 'Lahore',
      gender: 'mixed',
      status: 'active',
      version: 1,
      capacity: 600,
    });
    expect(response.data.id).toMatch(/^[0-9a-f-]{36}$/);
    // Internal columns never leave the server.
    expect(Object.keys(response.data)).not.toContain('orgId');
    expect(Object.keys(response.data)).not.toContain('deletedAt');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });

  it('trims and tidies what was typed', async () => {
    const response = await create(
      director,
      newBranch({ code: ' ab1 ', name: '  North   Campus ', email: 'Office@Roshan.Test' }),
    );
    expect(response.data).toMatchObject({
      code: 'AB1',
      name: 'North Campus',
      email: 'office@roshan.test',
    });
  });

  it('reads one branch', async () => {
    const response = await read(principal, school.mainBranchId);
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      id: school.mainBranchId,
      code: 'MC',
      name: 'Main Campus',
    });
  });

  it('lists with paging, search, filters and sorting', async () => {
    const all = await list(director, '?sort=code&order=asc&pageSize=100');
    expect(all.status).toBe(200);
    const codes = all.data.items.map((branch) => branch.code);
    expect(codes).toEqual([...codes].sort());
    expect(all.data.total).toBe(codes.length);
    expect(codes).toEqual(expect.arrayContaining(['MC', 'CC', 'GT', 'AB1']));

    const paged = await list(director, '?sort=code&pageSize=2&page=2');
    expect(paged.data).toMatchObject({ page: 2, pageSize: 2, total: all.data.total });
    expect(paged.data.items.map((branch) => branch.code)).toEqual(codes.slice(2, 4));

    expect((await list(director, '?q=garden')).data.items.map((branch) => branch.code)).toEqual([
      'GT',
    ]);
    expect((await list(director, '?q=گارڈن')).data.items.map((branch) => branch.code)).toEqual([
      'GT',
    ]);
    expect((await list(director, '?q=100%25')).data.items).toEqual([]); // a percent sign is searched for, not treated as "anything"
    expect((await list(director, '?status=inactive')).data.items).toEqual([]);
    expect((await list(director, '?city=lahore')).data.total).toBe(all.data.total);
    const byName = await list(director, '?sort=name&order=desc');
    const names = byName.data.items.map((branch) => branch.name);
    expect(names).toEqual([...names].sort().reverse());
  });

  it('updates some fields, leaves the rest, and raises the version', async () => {
    const created = (await create(director, newBranch({ code: 'UP', phone: '042-1111111' }))).data;
    const response = await patch(director, created.id, {
      version: created.version,
      name: 'Updated Campus',
      capacity: 450,
    });
    expect(response.status).toBe(200);
    // A phone number is stored in one international form, however it was typed.
    expect(response.data).toMatchObject({
      name: 'Updated Campus',
      capacity: 450,
      phone: '+92421111111',
      version: 2,
    });
  });

  it('409 STALE: a save made against an old version is refused, and nothing is overwritten', async () => {
    const created = (await create(director, newBranch({ code: 'ST' }))).data;
    await patch(director, created.id, { version: 1, name: 'First Save' });
    const second = await patch(principal, created.id, { version: 1, name: 'Second Save' });
    expect(second.status).toBe(409);
    expect(second.error).toMatchObject({ code: 'STALE' });
    expect((await read(director, created.id)).data.name).toBe('First Save');
  });
});

describe('branches: who may do what', () => {
  it('401: no session', async () => {
    const response = await callRoute(collection.GET, { url: '/api/v1/branches' });
    expect(response.status).toBe(401);
    expect(response.error?.code).toBe('UNAUTHENTICATED');
  });

  it('403: a role without the permission cannot create or change a branch', async () => {
    expect((await create(principal, newBranch())).status).toBe(403); // a principal may change, not add
    expect((await create(teacher, newBranch())).error?.code).toBe('FORBIDDEN');
    expect(
      (await patch(teacher, school.mainBranchId, { version: 1, name: 'Hijacked' })).status,
    ).toBe(403);
    expect((await read(teacher, school.mainBranchId)).status).toBe(200); // every member of staff may look
  });

  it('403: a guardian cannot use the branch routes at all', async () => {
    expect((await list(guardian)).status).toBe(403);
    expect((await read(guardian, school.mainBranchId)).status).toBe(403);
  });

  it('T-org-9: staff of another school can neither see nor change a branch here', async () => {
    const stranger = await other.actor('director');
    expect((await read(stranger, school.mainBranchId)).status).toBe(404);
    expect(
      (await patch(stranger, school.mainBranchId, { version: 1, name: 'Taken Over' })).status,
    ).toBe(404);
    const theirs = await list(stranger, '?pageSize=100');
    expect(theirs.data.items.map((branch) => branch.code).sort()).toEqual(['CC', 'MC']);
    expect((await read(director, school.mainBranchId)).data.name).toBe('Main Campus');
  });

  it('a request from another site’s page is refused, even with a valid session', async () => {
    const response = await callRoute(collection.POST, {
      as: director,
      method: 'POST',
      url: '/api/v1/branches',
      body: newBranch(),
      crossSite: true,
    });
    expect(response.status).toBe(403);
    const hostile = await callRoute(collection.POST, {
      as: director,
      method: 'POST',
      url: '/api/v1/branches',
      body: newBranch(),
      headers: { origin: 'https://evil.example' },
    });
    expect(hostile.status).toBe(403);
    // Reading is not at risk and needs no origin.
    expect(
      (await callRoute(collection.GET, { as: director, url: '/api/v1/branches', crossSite: true }))
        .status,
    ).toBe(200);
  });
});

describe('branches: validation', () => {
  it('422 with a message under each wrong field', async () => {
    const response = await create(director, {
      code: 'toolongcode',
      name: 'A',
      city: 'Lahore',
      email: 'not-an-email',
      capacity: 0,
    });
    expect(response.status).toBe(422);
    expect(response.error?.code).toBe('VALIDATION');
    expect(Object.keys(response.error?.fields ?? {}).sort()).toEqual([
      'address',
      'capacity',
      'code',
      'email',
      'name',
    ]);
  });

  it('422: a body that is not JSON, and a query parameter that does not exist', async () => {
    const broken = await callRoute(collection.POST, {
      as: director,
      method: 'POST',
      url: '/api/v1/branches',
      body: '{not json',
    });
    expect(broken.status).toBe(422);
    const typo = await list(director, '?statuss=active');
    expect(typo.status).toBe(422);
    expect((await list(director, '?sort=secret')).status).toBe(422);
    expect((await list(director, '?pageSize=5000')).status).toBe(422);
  });

  it('422: an id that is not an id, and 404 for one that does not exist', async () => {
    expect((await read(director, 'not-a-uuid')).status).toBe(422);
    expect((await read(director, randomUUID())).status).toBe(404);
    expect((await patch(director, randomUUID(), { version: 1, name: 'Nobody' })).status).toBe(404);
  });

  it('a field the client must not set is ignored: status, organisation, version', async () => {
    const response = await create(director, {
      ...newBranch({ code: 'IG' }),
      status: 'inactive',
      orgId: other.orgId,
      version: 40,
    });
    expect(response.status).toBe(201);
    expect(response.data).toMatchObject({ status: 'active', version: 1 });
    const [row] = await adminDb().select().from(branches).where(eq(branches.id, response.data.id));
    expect(row?.orgId).toBe(school.orgId);
    expect(row?.createdBy).toBe(director.userId);
  });
});

describe('branches: rules', () => {
  it('R-org-3 / T-org-3: a code is unique within the group, with the message under the field', async () => {
    const response = await create(director, newBranch({ code: 'MC' }));
    expect(response.status).toBe(409);
    expect(response.error).toMatchObject({
      code: 'CONFLICT',
      message: 'Another branch already uses this code',
      fields: { code: ['Another branch already uses this code'] },
    });
    // Another school may use the same code.
    const stranger = await other.actor('director');
    expect((await create(stranger, newBranch({ code: 'GT' }))).status).toBe(201);
  });

  it('R-org-3 / F-org-6: the code is fixed once a number has been issued with it', async () => {
    const created = (await create(director, newBranch({ code: 'NUM' }))).data;
    const renamed = await patch(director, created.id, { version: 1, code: 'NUM2' });
    expect(renamed.status).toBe(200); // nothing issued yet

    await as(director, (ctx) =>
      nextValue(ctx, 'admission', { branchId: created.id, period: '26' }),
    );
    const refused = await patch(director, created.id, { version: 2, code: 'NUM3' });
    expect(refused.status).toBe(409);
    expect(refused.error?.code).toBe('RULE');
    expect(
      (await patch(director, created.id, { version: 2, name: 'Still Renameable' })).status,
    ).toBe(200);
  });

  it('R-org-4 / T-org-4: the last active branch cannot be deactivated', async () => {
    const small = await seedOrg();
    const owner = await small.actor('owner');
    const first = await setStatus(deactivate, owner, small.cityBranchId, 1);
    expect(first.status).toBe(200);
    expect(first.data.status).toBe('inactive');
    const last = await setStatus(deactivate, owner, small.mainBranchId, 1);
    expect(last.status).toBe(409);
    expect(last.error).toMatchObject({
      code: 'RULE',
      message: 'A school group needs at least one active branch',
    });
  });

  it('R-org-5 / F-org-3: a branch with active students cannot be deactivated, and the message says how many', async () => {
    const created = (await create(director, newBranch({ code: 'BLK' }))).data;
    registerBranchBlocker(async (_ctx, branchId) =>
      branchId === created.id
        ? '412 active students must be transferred or withdrawn first'
        : undefined,
    );
    const response = await setStatus(deactivate, director, created.id, 1);
    expect(response.status).toBe(409);
    expect(response.error?.message).toContain(
      '412 active students must be transferred or withdrawn first',
    );
    expect((await read(director, created.id)).data.status).toBe('active');
  });

  it('R-org-6: an inactive branch is read-only until it is activated again', async () => {
    const created = (await create(director, newBranch({ code: 'OFF' }))).data;
    const off = await setStatus(deactivate, director, created.id, 1);
    expect(off.data).toMatchObject({ status: 'inactive', version: 2 });
    expect((await read(director, created.id)).status).toBe(200);
    const edit = await patch(director, created.id, { version: 2, name: 'Edited While Closed' });
    expect(edit.status).toBe(409);
    expect(edit.error?.code).toBe('RULE');

    const on = await setStatus(activate, director, created.id, 2);
    expect(on.data).toMatchObject({ status: 'active', version: 3 });
    expect((await patch(director, created.id, { version: 3, name: 'Open Again' })).status).toBe(
      200,
    );
    // Activating what is already active changes nothing and is not an error.
    expect((await setStatus(activate, director, created.id, 4)).data.version).toBe(4);
  });

  it('a principal can change only a branch they are assigned to', async () => {
    const response = await setStatus(deactivate, principal, school.cityBranchId, 1);
    expect(response.status).toBe(403);
  });

  it('a branch cannot be deleted', async () => {
    expect('DELETE' in item).toBe(false);
  });
});

describe('branches: audit and rollback', () => {
  it('each write leaves one entry, with only what changed', async () => {
    const created = (await create(director, newBranch({ code: 'AUD' }))).data;
    await patch(director, created.id, { version: 1, capacity: 300 });
    await setStatus(deactivate, director, created.id, 2);

    const entries = await adminDb()
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, 'branches'), eq(auditLog.entityId, created.id)));
    const byAction = Object.fromEntries(entries.map((entry) => [entry.action, entry]));
    expect(Object.keys(byAction).sort()).toEqual(['create', 'deactivate', 'update']);
    expect(byAction.create).toMatchObject({
      actorId: director.userId,
      actorKind: 'staff',
      source: 'api',
      orgId: school.orgId,
    });
    expect(byAction.update?.changes).toEqual({ capacity: [null, 300] });
    expect(byAction.deactivate?.changes).toEqual({ status: ['active', 'inactive'] });
    expect(byAction.create?.summary).toBe('Added branch Garden Town Campus (AUD)');
  });

  it('a request that fails leaves nothing behind: no row and no audit entry', async () => {
    const before = await adminDb()
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(eq(auditLog.orgId, school.orgId));
    const response = await create(director, newBranch({ code: 'MC' })); // refused by the unique code
    expect(response.status).toBe(409);
    const after = await adminDb()
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(eq(auditLog.orgId, school.orgId));
    expect(after).toHaveLength(before.length);
  });
});
