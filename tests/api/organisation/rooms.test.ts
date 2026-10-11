import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ApiError, configureApi, meApi, roomsApi } from '@takhti/api-client';
import type { Me, Page, Room } from '@takhti/contracts';
import { registerRoomUse, roomsDb, roomsService, type Actor } from '@takhti/core';
import { adminDb, auditLog, branches, rooms, withAdminTx } from '@takhti/db';
import * as meRoute from '../../../apps/web/app/api/v1/me/route';
import * as membershipsRoute from '../../../apps/web/app/api/v1/me/memberships/route';
import * as switchRoute from '../../../apps/web/app/api/v1/me/switch-org/route';
import * as collection from '../../../apps/web/app/api/v1/rooms/route';
import * as item from '../../../apps/web/app/api/v1/rooms/[id]/route';
import { callRoute, fetchThrough } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { as, expectError, seedOrg, type TestOrg } from '../../helpers/world';

/*
 * The second resource, added by following docs/reference/adding-a-resource.md without touching the
 * kernel. It is branch-scoped, so it also proves branch isolation end to end.
 */

let db: TestDb;
let school: TestOrg;
let other: TestOrg;
let principal: Actor; // Main Campus
let cityPrincipal: Actor; // City Campus
let owner: Actor; // every branch
let teacher: Actor;
let guardian: Actor;

const post = (actor: Actor, body: unknown) =>
  callRoute<Room>(collection.POST, { as: actor, method: 'POST', url: '/api/v1/rooms', body });
const list = (actor: Actor, query = '') =>
  callRoute<Page<Room>>(collection.GET, { as: actor, url: `/api/v1/rooms${query}` });
const patch = (actor: Actor, id: string, body: unknown) =>
  callRoute<Room>(item.PATCH, {
    as: actor,
    method: 'PATCH',
    url: `/api/v1/rooms/${id}`,
    params: { id },
    body,
  });
const remove = (actor: Actor, id: string) =>
  callRoute(item.DELETE, {
    as: actor,
    method: 'DELETE',
    url: `/api/v1/rooms/${id}`,
    params: { id },
  });

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  other = await seedOrg();
  principal = await school.actor('principal');
  cityPrincipal = await school.actor('principal', { branch: 'city' });
  owner = await school.actor('owner');
  teacher = await school.actor('class_teacher');
  guardian = await school.actor('guardian');
});
afterAll(async () => {
  await db.destroy();
});

describe('rooms: create, read, list, update, delete', () => {
  it('the whole life of a room', async () => {
    const created = await post(principal, {
      branchId: school.mainBranchId,
      name: 'Physics Lab',
      kind: 'lab',
      capacity: 30,
      floor: 'First',
    });
    expect(created.status).toBe(201);
    expect(created.data).toMatchObject({
      branchId: school.mainBranchId,
      name: 'Physics Lab',
      kind: 'lab',
      capacity: 30,
      floor: 'First',
      isBookable: false,
      version: 1,
    });

    const updated = await patch(principal, created.data.id, {
      version: 1,
      isBookable: true,
      capacity: null,
    });
    expect(updated.data).toMatchObject({
      isBookable: true,
      capacity: null,
      name: 'Physics Lab',
      version: 2,
    });

    expect((await remove(principal, created.data.id)).status).toBe(204);
    expect(
      (await callRoute(item.GET, { as: principal, url: '/x', params: { id: created.data.id } }))
        .status,
    ).toBe(404);
    // Soft delete: the row is still there, marked, so history and offline devices can learn it is gone.
    const [row] = await adminDb().select().from(rooms).where(eq(rooms.id, created.data.id));
    expect(row?.deletedAt).not.toBeNull();
    // Its name is free again.
    expect(
      (await post(principal, { branchId: school.mainBranchId, name: 'Physics Lab' })).status,
    ).toBe(201);
  });

  it('defaults: a room is a classroom, and not bookable, unless stated', async () => {
    const created = await post(principal, { branchId: school.mainBranchId, name: 'Room 12' });
    expect(created.data).toMatchObject({
      kind: 'classroom',
      isBookable: false,
      capacity: null,
      floor: null,
    });
  });

  it('lists with each filter and sort', async () => {
    await post(principal, {
      branchId: school.mainBranchId,
      name: 'Computer Lab',
      kind: 'lab',
      capacity: 40,
      isBookable: true,
    });
    await post(principal, {
      branchId: school.mainBranchId,
      name: 'Assembly Hall',
      kind: 'hall',
      capacity: 500,
      isBookable: true,
    });
    await post(cityPrincipal, {
      branchId: school.cityBranchId,
      name: 'City Library',
      kind: 'library',
      capacity: 60,
    });

    expect((await list(principal, '?kind=lab')).data.items.map((room) => room.name).sort()).toEqual(
      ['Computer Lab'],
    );
    expect(
      (await list(principal, '?isBookable=true&sort=capacity&order=desc')).data.items.map(
        (room) => room.name,
      ),
    ).toEqual(['Assembly Hall', 'Computer Lab']);
    expect((await list(principal, '?q=hall')).data.items.map((room) => room.name)).toEqual([
      'Assembly Hall',
    ]);
    expect(
      (await list(owner, `?branchId=${school.cityBranchId}`)).data.items.map((room) => room.name),
    ).toEqual(['City Library']);
    const sorted = await list(owner, '?sort=name&pageSize=100');
    expect(sorted.data.items.map((room) => room.name)).toEqual(
      [...sorted.data.items.map((room) => room.name)].sort(),
    );
  });
});

describe('rooms: branches keep apart', () => {
  it('a principal sees and changes only the rooms of their own branch', async () => {
    const mine = (await list(principal, '?pageSize=100')).data.items;
    const theirs = (await list(cityPrincipal, '?pageSize=100')).data.items;
    expect(mine.every((room) => room.branchId === school.mainBranchId)).toBe(true);
    expect(theirs.map((room) => room.name)).toEqual(['City Library']);

    const cityRoom = theirs[0]!;
    expect((await patch(principal, cityRoom.id, { version: 1, name: 'Taken' })).status).toBe(404);
    expect((await remove(principal, cityRoom.id)).status).toBe(404);
    expect(
      (await post(principal, { branchId: school.cityBranchId, name: 'Planted Room' })).status,
    ).toBe(403);
  });

  it('someone with every branch sees all of them, and can narrow to one with x-branch-id', async () => {
    const everything = (await list(owner, '?pageSize=100')).data.items;
    expect(new Set(everything.map((room) => room.branchId))).toEqual(
      new Set([school.mainBranchId, school.cityBranchId]),
    );

    const narrowed = await callRoute<Page<Room>>(collection.GET, {
      as: owner,
      url: '/api/v1/rooms?pageSize=100',
      headers: { 'x-branch-id': school.cityBranchId },
    });
    expect(narrowed.data.items.map((room) => room.name)).toEqual(['City Library']);
  });

  it('x-branch-id is checked against the person’s access', async () => {
    const refused = await callRoute(collection.GET, {
      as: principal,
      url: '/api/v1/rooms',
      headers: { 'x-branch-id': school.cityBranchId },
    });
    expect(refused.status).toBe(403);
    expect(
      (
        await callRoute(collection.GET, {
          as: principal,
          url: '/api/v1/rooms',
          headers: { 'x-branch-id': 'nonsense' },
        })
      ).status,
    ).toBe(422);
  });

  it('another school sees none of it', async () => {
    const stranger = await other.actor('owner');
    expect((await list(stranger)).data.items).toEqual([]);
    const smuggled = await post(stranger, { branchId: school.mainBranchId, name: 'Smuggled' });
    expect(smuggled.status).toBe(422);
    expect(smuggled.error?.fields).toEqual({ branchId: ['Choose a branch of this school group'] });
    expect(await adminDb().select().from(rooms).where(eq(rooms.name, 'Smuggled'))).toEqual([]);
  });
});

describe('rooms: permissions and rules', () => {
  it('403: one permission covers creating, changing and deleting; a teacher has only read', async () => {
    const room = (
      await post(principal, { branchId: school.mainBranchId, name: 'Staff Room', kind: 'office' })
    ).data;
    expect((await list(teacher)).status).toBe(200);
    expect((await post(teacher, { branchId: school.mainBranchId, name: 'Mine' })).status).toBe(403);
    expect((await patch(teacher, room.id, { version: 1, name: 'Mine' })).status).toBe(403);
    expect((await remove(teacher, room.id)).status).toBe(403);
    expect((await list(guardian)).status).toBe(403);
  });

  it('a room name is unique within its branch, with the message under the field; another branch may reuse it', async () => {
    await post(principal, { branchId: school.mainBranchId, name: 'Room 1' });
    const again = await post(principal, { branchId: school.mainBranchId, name: 'Room 1' });
    expect(again.status).toBe(409);
    expect(again.error).toMatchObject({
      code: 'CONFLICT',
      fields: { name: ['This branch already has a room with this name'] },
    });
    expect(
      (await post(cityPrincipal, { branchId: school.cityBranchId, name: 'Room 1' })).status,
    ).toBe(201);
  });

  it('422: capacity must be at least 1, and the branch must be given', async () => {
    const response = await post(principal, { name: 'No Branch', capacity: 0 });
    expect(response.status).toBe(422);
    expect(Object.keys(response.error?.fields ?? {}).sort()).toEqual(['branchId', 'capacity']);
  });

  it('R-org-10 / T-org-7: a room in use cannot be deleted', async () => {
    const room = (await post(principal, { branchId: school.mainBranchId, name: 'Class 5-A Room' }))
      .data;
    registerRoomUse(async (_ctx, roomId) =>
      roomId === room.id ? 'it is the classroom of section 5-A' : undefined,
    );
    const response = await remove(principal, room.id);
    expect(response.status).toBe(409);
    expect(response.error).toMatchObject({
      code: 'RULE',
      message: 'This room is in use: it is the classroom of section 5-A',
    });
  });

  it('R-org-6 / T-org-5: an inactive branch refuses writes', async () => {
    const closing = await seedOrg();
    const boss = await closing.actor('owner');
    const room = (await post(boss, { branchId: closing.cityBranchId, name: 'Old Room' })).data;
    await withAdminTx((tx) =>
      tx.update(branches).set({ status: 'inactive' }).where(eq(branches.id, closing.cityBranchId)),
    );

    const refused = await post(boss, { branchId: closing.cityBranchId, name: 'New Room' });
    expect(refused.status).toBe(409);
    expect(refused.error?.message).toBe(
      'City Campus is inactive, so nothing can be added or changed there',
    );
    expect((await patch(boss, room.id, { version: 1, name: 'Renamed' })).status).toBe(409);
    expect((await remove(boss, room.id)).status).toBe(409);
    expect((await list(boss)).data.items.map((entry) => entry.name)).toEqual(['Old Room']); // still readable
  });

  it('a deleted room can be restored, unless its name has been taken since', async () => {
    const room = (await post(principal, { branchId: school.mainBranchId, name: 'Art Room' })).data;
    await remove(principal, room.id);
    const restored = await as(principal, (ctx) => roomsService.restore(ctx, room.id));
    expect(restored).toMatchObject({ id: room.id, name: 'Art Room', version: 3 });

    await remove(principal, room.id);
    await post(principal, { branchId: school.mainBranchId, name: 'Art Room' });
    await expectError('CONFLICT', () => as(principal, (ctx) => roomsService.restore(ctx, room.id)));
  });

  it('many rooms in one call: the good ones are saved, each bad one is reported with its reason', async () => {
    const result = await as(principal, (ctx) =>
      roomsService.createMany(ctx, [
        { branchId: school.mainBranchId, name: 'Bulk A' },
        { branchId: school.mainBranchId, name: 'Room 1' }, // already exists
        { branchId: school.cityBranchId, name: 'Bulk Wrong Branch' }, // not this principal's branch
        { branchId: school.mainBranchId, name: 'Bulk B' },
      ]),
    );
    expect(result.succeeded.map((room) => room.name)).toEqual(['Bulk A', 'Bulk B']);
    expect(result.failed.map((failure) => [failure.index, failure.code])).toEqual([
      [1, 'CONFLICT'],
      [2, 'FORBIDDEN'],
    ]);
    const saved = await list(principal, '?q=Bulk');
    expect(saved.data.items.map((room) => room.name).sort()).toEqual(['Bulk A', 'Bulk B']);
  });

  it('a very long list can be paged by cursor, newest first, without counting', async () => {
    const first = await as(owner, (ctx) => roomsDb.listCursor(ctx, { limit: 3 }));
    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).toBeTruthy();
    const second = await as(owner, (ctx) =>
      roomsDb.listCursor(ctx, { limit: 3, cursor: first.nextCursor ?? undefined }),
    );
    const ids = [...first.items, ...second.items].map((room) => room.id);
    expect(new Set(ids).size).toBe(ids.length);
    const stamps = [...first.items, ...second.items].map((room) => `${room.createdAt}|${room.id}`);
    expect(stamps).toEqual([...stamps].sort().reverse());
    await expectError('VALIDATION', () =>
      as(owner, (ctx) => roomsDb.listCursor(ctx, { limit: 3, cursor: 'garbage' })),
    );
  });

  it('each write is audited with a readable line', async () => {
    const room = (await post(principal, { branchId: school.mainBranchId, name: 'Audit Room' }))
      .data;
    await remove(principal, room.id);
    const entries = await adminDb()
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, 'rooms'), eq(auditLog.entityId, room.id)));
    expect(entries.map((entry) => [entry.action, entry.summary, entry.branchId]).sort()).toEqual([
      ['create', 'Added room Audit Room', school.mainBranchId],
      ['delete', 'Deleted room Audit Room', school.mainBranchId],
    ]);
  });
});

describe('the API client drives the real routes', () => {
  const routes = {
    '/rooms': collection,
    '/rooms/[id]': item,
    '/me': meRoute,
    '/me/memberships': membershipsRoute,
    '/me/switch-org': switchRoute,
  };

  it('create, list, update and delete through the typed client', async () => {
    configureApi({
      baseUrl: 'http://localhost:3000/api/v1',
      fetch: fetchThrough(routes, principal),
    });
    const created = await roomsApi.create({
      branchId: school.mainBranchId,
      name: 'Client Room',
      kind: 'lab',
    });
    expect(created).toMatchObject({ name: 'Client Room', kind: 'lab', version: 1 });

    const page = await roomsApi.list({ q: 'Client', kind: 'lab', sort: 'name' });
    expect(page.items.map((room) => room.id)).toEqual([created.id]);

    const updated = await roomsApi.update(created.id, { version: created.version, capacity: 25 });
    expect(updated.capacity).toBe(25);
    await expect(roomsApi.remove(created.id)).resolves.toBeUndefined();
  });

  it('a refusal arrives as one error type carrying the code, the message and the fields', async () => {
    configureApi({
      baseUrl: 'http://localhost:3000/api/v1',
      fetch: fetchThrough(routes, principal),
    });
    const error = await roomsApi
      .create({ branchId: school.mainBranchId, name: 'Room 1' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 409,
      code: 'CONFLICT',
      fields: { name: ['This branch already has a room with this name'] },
    });
    expect((error as ApiError).requestId).toBeTruthy();

    const stale = await roomsApi
      .update(randomUUID(), { version: 1, name: 'Nobody' })
      .catch((caught: unknown) => caught);
    expect(stale).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('an expired session is reported once to the app', async () => {
    const seen: string[] = [];
    configureApi({
      baseUrl: 'http://localhost:3000/api/v1',
      fetch: fetchThrough(routes, undefined),
      onUnauthenticated: (error) => seen.push(error.code),
    });
    await expect(roomsApi.list()).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(seen).toEqual(['UNAUTHENTICATED']);
    configureApi({ onUnauthenticated: () => {} });
  });

  it('a dropped connection is retried once for a read, and reported plainly if it stays down', async () => {
    let calls = 0;
    const real = fetchThrough(routes, principal);
    configureApi({
      baseUrl: 'http://localhost:3000/api/v1',
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls += 1;
        if (calls === 1) throw new TypeError('fetch failed');
        return real(input, init);
      }) as typeof fetch,
    });
    await expect(roomsApi.list()).resolves.toBeDefined();
    expect(calls).toBe(2);

    configureApi({
      fetch: (async () => Promise.reject(new TypeError('fetch failed'))) as typeof fetch,
    });
    const error = await roomsApi.list().catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 0, isNetworkError: true });
    // A write that is not marked idempotent is never repeated.
    let writes = 0;
    configureApi({
      fetch: (async () => {
        writes += 1;
        throw new TypeError('fetch failed');
      }) as typeof fetch,
    });
    await expect(
      roomsApi.create({ branchId: school.mainBranchId, name: 'Never' }),
    ).rejects.toMatchObject({ status: 0 });
    expect(writes).toBe(1);
  });

  it('GET /me: one response with everything a portal shell needs', async () => {
    configureApi({
      baseUrl: 'http://localhost:3000/api/v1',
      fetch: fetchThrough(routes, principal),
    });
    const me: Me = await meApi.get();
    expect(me.user.id).toBe(principal.userId);
    expect(me.membership).toMatchObject({
      id: principal.membershipId,
      kind: 'staff',
      roleKeys: ['principal'],
      allBranches: false,
    });
    expect(me.org).toMatchObject({ id: school.orgId, slug: school.slug });
    expect(me.branches.map((branch) => branch.code)).toEqual(['MC']);
    expect(me.permissions).toContain('rooms:update');
    expect(me.permissions).not.toContain('branches:create');
    expect(me.modules).toContain('fees');

    configureApi({ fetch: fetchThrough(routes, owner) });
    expect((await meApi.get()).branches.map((branch) => branch.code).sort()).toEqual(['CC', 'MC']);
    configureApi({ fetch: fetchThrough(routes, guardian) });
    const family = await meApi.get();
    expect(family.membership.kind).toBe('guardian');
    expect(family.branches.map((branch) => branch.code).sort()).toEqual(['CC', 'MC']);
    expect(family.permissions).not.toContain('rooms:read');
  });

  it('a person in two schools lists both, chooses one, and is then that member', async () => {
    const person = await school.member({ role: 'subject_teacher' });
    const elsewhere = await other.member({ role: 'guardian', userId: person.userId });
    configureApi({
      baseUrl: 'http://localhost:3000/api/v1',
      fetch: fetchThrough(routes, { userId: person.userId }),
    });

    const choices = await meApi.memberships();
    expect(choices.map((choice) => choice.orgId).sort()).toEqual(
      [school.orgId, other.orgId].sort(),
    );
    await expect(meApi.get()).rejects.toMatchObject({ status: 403 }); // not chosen yet

    const chosen = await meApi.switchOrg(elsewhere.membershipId);
    expect(chosen).toMatchObject({
      membershipId: elsewhere.membershipId,
      orgId: other.orgId,
      kind: 'guardian',
    });
    const cookie = await callRoute(switchRoute.POST, {
      as: { userId: person.userId },
      method: 'POST',
      url: '/api/v1/me/switch-org',
      body: { membershipId: elsewhere.membershipId },
    });
    expect(cookie.headers.get('set-cookie')).toMatch(
      /^takhti_membership=[0-9a-f-]{36}; Path=\/; HttpOnly; SameSite=Lax/,
    );

    const asChosen = await callRoute<Me>(meRoute.GET, {
      as: { userId: person.userId },
      url: '/api/v1/me',
      headers: { cookie: `takhti_membership=${elsewhere.membershipId}` },
    });
    expect(asChosen.data.org.id).toBe(other.orgId);
    // Someone else's membership cannot be chosen.
    await expect(meApi.switchOrg(principal.membershipId)).rejects.toMatchObject({ status: 403 });
  });
});
