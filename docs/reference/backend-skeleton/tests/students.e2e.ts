/**
 * Runs the students module end to end against a real Postgres (PGlite, in-process):
 * the generated migration, row-level security, the db-service, the service, the HTTP routes
 * and the API client.
 *
 *   pnpm test
 */
import './setup-env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { ApiError, configureApi, studentsApi } from '@school/api-client';
import {
  CreateStudent,
  ListStudents,
  UpdateStudent,
  studentsContract,
  type ApiErrorBody,
  type ErrorCode,
  type Page,
  type Student,
} from '@school/contracts';
import {
  AppError,
  createRoutes,
  studentsDb,
  studentsService,
  toErrorResponse,
  type Actor,
  type Ctx,
  type RouteDeps,
} from '@school/core';
import { auditLog, branches, students, type Tx } from '@school/db';

const pg = new PGlite();
const db = drizzle({ client: pg });

// --- database set-up: the hand-written helpers, then the generated migration ------------------------------

const dbDir = join(process.cwd(), 'packages', 'db');
await pg.exec('create role authenticated nologin;');
await pg.exec(readFileSync(join(dbDir, 'sql', '0000_app_helpers.sql'), 'utf8'));
for (const folder of readdirSync(join(dbDir, 'migrations')).sort()) {
  await pg.exec(readFileSync(join(dbDir, 'migrations', folder, 'migration.sql'), 'utf8'));
}
await pg.exec(`
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
`);

// --- the same two statements as `withUserTx`, on the test database ------------------------------------

let requests = 0;
const run: RouteDeps['run'] = (actor, meta, work) =>
  db.transaction(async (tx) => {
    const claims = {
      sub: actor.userId,
      role: 'authenticated',
      org_id: actor.orgId,
      role_key: actor.roleKey,
      branch_ids: actor.branchIds,
      all_branches: actor.allBranches,
    };
    await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`);
    await tx.execute(sql`set local role authenticated`);
    return work({ db: tx as unknown as Tx, actor, ...meta });
  });

const as = <T>(actor: Actor, work: (ctx: Ctx) => Promise<T>) =>
  run(actor, { requestId: `test-${++requests}`, source: 'api' }, work);

async function expectError(code: ErrorCode, work: () => Promise<unknown>) {
  try {
    await work();
  } catch (error) {
    const { body } = toErrorResponse(error, 'test');
    assert.equal(body.error.code, code, `expected ${code}, got ${body.error.code}: ${body.error.message}`);
    return body.error;
  }
  assert.fail(`expected ${code}, but nothing was thrown`);
}

let checks = 0;
const ok = (label: string) => console.log(`  ok ${String(++checks).padStart(2)}  ${label}`);

// --- two school groups, three branches, three users ---------------------------------------------------

const orgA = randomUUID();
const orgB = randomUUID();
const branchA1 = randomUUID();
const branchA2 = randomUUID();
const branchB1 = randomUUID();

await db.insert(branches).values([
  { id: branchA1, orgId: orgA, name: 'Main Campus', code: 'A1' },
  { id: branchA2, orgId: orgA, name: 'City Campus', code: 'A2' },
  { id: branchB1, orgId: orgB, name: 'Other School', code: 'B1' },
]);

const everything = new Set(['students:read', 'students:create', 'students:update', 'students:delete']);
const adminA: Actor = { userId: randomUUID(), orgId: orgA, roleKey: 'admin', branchIds: [], allBranches: true, permissions: everything };
const adminB: Actor = { userId: randomUUID(), orgId: orgB, roleKey: 'admin', branchIds: [], allBranches: true, permissions: everything };
const teacherA1: Actor = {
  userId: randomUUID(),
  orgId: orgA,
  roleKey: 'teacher',
  branchIds: [branchA1],
  allBranches: false,
  permissions: new Set(['students:read']),
};
/** Allowed to write, but only in branch A1. */
const clerkA1: Actor = { ...teacherA1, userId: randomUUID(), roleKey: 'clerk', permissions: everything };

const input = (overrides: Record<string, unknown>) =>
  CreateStudent.parse({
    branchId: branchA1,
    admissionNo: 'A-001',
    fullName: '  Ali Raza ',
    fatherName: 'Raza Khan',
    gender: 'male',
    dateOfBirth: '2015-03-14',
    bFormNo: '35202-1234567-1',
    sectionId: null,
    admittedOn: '2026-04-01',
    ...overrides,
  });

console.log('service layer');

const ali = await as(adminA, (ctx) => studentsService.create(ctx, input({})));
assert.equal(ali.fullName, 'Ali Raza');
assert.equal(ali.version, 1);
assert.equal(ali.dateOfBirth, '2015-03-14');
assert.equal(ali.status, 'active');
assert.equal('orgId' in ali, false);
ok('create returns the contract shape: trimmed, dates as text, no internal columns');

await expectError('RULE', () => as(adminA, (ctx) => studentsService.create(ctx, input({ fullName: 'Someone Else' }))));
ok('business rule: duplicate admission number is refused');

const sara = await as(adminA, (ctx) =>
  studentsService.create(ctx, input({ branchId: branchA2, admissionNo: 'A-002', fullName: 'Sara Malik', fatherName: 'Tariq Malik', gender: 'female' })),
);
await as(adminA, (ctx) =>
  studentsService.create(ctx, input({ admissionNo: 'A-003', fullName: 'Bilal Ahmed', fatherName: 'Hamid Raza' })),
);

const search = await as(adminA, (ctx) => studentsService.list(ctx, ListStudents.parse({ q: 'raza', sort: 'admissionNo' })));
assert.deepEqual(search.items.map((s) => s.admissionNo), ['A-001', 'A-003']);
ok('list: search looks in name and father name, sorted by the chosen column');

const paged = await as(adminA, (ctx) =>
  studentsService.list(ctx, ListStudents.parse({ page: '2', pageSize: '1', sort: 'admissionNo', order: 'desc' })),
);
assert.equal(paged.total, 3);
assert.deepEqual(paged.items.map((s) => s.admissionNo), ['A-002']);
ok('list: paging and descending order, with the full total');

const filtered = await as(adminA, (ctx) => studentsService.list(ctx, ListStudents.parse({ branchId: branchA2 })));
assert.deepEqual(filtered.items.map((s) => s.id), [sara.id]);
ok('list: module filter');

console.log('security');

await expectError('FORBIDDEN', () => as(teacherA1, (ctx) => studentsService.create(ctx, input({ admissionNo: 'A-050' }))));
ok('permission check: a teacher without students:create is refused');

const teacherView = await as(teacherA1, (ctx) => studentsService.list(ctx, ListStudents.parse({})));
assert.deepEqual(teacherView.items.map((s) => s.admissionNo).sort(), ['A-001', 'A-003']);
ok('row-level security: a branch user sees only that branch');

const otherSchool = await as(adminB, (ctx) => studentsService.list(ctx, ListStudents.parse({})));
assert.equal(otherSchool.total, 0);
await expectError('NOT_FOUND', () => as(adminB, (ctx) => studentsService.get(ctx, ali.id)));
ok('row-level security: another school sees nothing, even by id');

await expectError('FORBIDDEN', () =>
  as(clerkA1, (ctx) => studentsService.create(ctx, input({ branchId: branchA2, admissionNo: 'A-051' }))),
);
ok('row-level security: cannot write into a branch you are not assigned to');

await expectError('FORBIDDEN', () =>
  as(adminA, (ctx) =>
    ctx.db.insert(students).values({ ...input({ admissionNo: 'A-052' }), orgId: orgB, branchId: branchB1 }),
  ),
);
ok('row-level security: a query that forges another school id is rejected by Postgres');

console.log('updates');

const renamed = await as(adminA, (ctx) =>
  studentsService.update(ctx, ali.id, UpdateStudent.parse({ version: 1, fullName: 'Ali Raza Khan' })),
);
assert.equal(renamed.version, 2);
assert.equal(renamed.fullName, 'Ali Raza Khan');
assert.equal(renamed.bFormNo, '35202-1234567-1');
ok('update: only the sent fields change, version goes up');

await expectError('STALE', () =>
  as(adminA, (ctx) => studentsService.update(ctx, ali.id, UpdateStudent.parse({ version: 1, fullName: 'Old Screen' }))),
);
ok('update: an edit made against an old version is refused');

const sectionId = randomUUID();
const moved = await as(adminA, (ctx) => studentsService.changeSection(ctx, ali.id, { sectionId, version: 2 }));
assert.equal(moved.sectionId, sectionId);
assert.equal(moved.version, 3);
ok('custom action: change section');

const trail = await as(adminA, (ctx) =>
  ctx.db.select().from(auditLog).where(eq(auditLog.entityId, ali.id)).orderBy(auditLog.at),
);
assert.deepEqual(trail.map((entry) => entry.action), ['create', 'update', 'change-section']);
assert.equal(trail.every((entry) => entry.actorId === adminA.userId && entry.orgId === orgA), true);
ok('audit log: one entry per change, written in the same transaction');

console.log('failures');

await expectError('CONFLICT', () => as(adminA, (ctx) => studentsDb.insert(ctx, input({ fullName: 'Duplicate' }))));
ok('database unique index is reported as CONFLICT, not as a 500');

await assert.rejects(
  as(adminA, async (ctx) => {
    await studentsService.create(ctx, input({ admissionNo: 'A-099' }));
    throw new Error('something failed later in the same request');
  }),
);
const afterFailure = await as(adminA, (ctx) => studentsService.list(ctx, ListStudents.parse({ q: 'A-099' })));
assert.equal(afterFailure.total, 0);
ok('transaction: when a request fails, nothing it wrote is kept');

const invalid = CreateStudent.safeParse({ ...input({}), bFormNo: '123', dateOfBirth: '14-03-2015' });
assert.equal(invalid.success, false);
const { status, body } = toErrorResponse(invalid.error, 'test');
assert.equal(status, 422);
assert.deepEqual(Object.keys(body.error.fields ?? {}).sort(), ['bFormNo', 'dateOfBirth']);
assert.deepEqual(body.error.fields?.bFormNo, ['Use the format 12345-1234567-1']);
ok('validation: errors are grouped per field, ready for a form');

console.log('delete');

await expectError('RULE', () => as(adminA, (ctx) => studentsService.remove(ctx, sara.id)));
ok('business rule: an active student cannot be deleted');

await as(adminA, async (ctx) => {
  const current = await studentsDb.get(ctx, sara.id);
  await studentsDb.update(ctx, sara.id, { status: 'left' }, current.version);
  await studentsService.remove(ctx, sara.id);
});
await expectError('NOT_FOUND', () => as(adminA, (ctx) => studentsService.get(ctx, sara.id)));
const [kept] = await db.select().from(students).where(and(eq(students.id, sara.id)));
assert.notEqual(kept?.deletedAt, null);
ok('soft delete: hidden from the app, still in the table for offline devices to learn about');

const reused = await as(adminA, (ctx) => studentsService.create(ctx, input({ admissionNo: 'A-002', fullName: 'New Student' })));
assert.equal(reused.admissionNo, 'A-002');
ok('a deleted student frees the admission number');

// --- HTTP layer: the real route builders, with a fake sign-in ------------------------------------------

console.log('http routes');

const actors = new Map([
  ['admin-a', adminA],
  ['teacher-a1', teacherA1],
]);
const { collectionRoutes, itemRoutes } = createRoutes({
  run,
  async authenticate(request) {
    const actor = actors.get(request.headers.get('x-test-user') ?? '');
    if (!actor) throw new AppError('UNAUTHENTICATED', 'Please sign in again');
    return actor;
  },
});
const collection = collectionRoutes(studentsContract, studentsService);
const item = itemRoutes(studentsContract, studentsService);

const call = (
  handler: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>,
  url: string,
  init: { user?: string; method?: string; body?: unknown; params?: Record<string, string> } = {},
) =>
  handler(
    new Request(`http://test/api/v1${url}`, {
      method: init.method ?? 'GET',
      headers: { ...(init.user && { 'x-test-user': init.user }), 'content-type': 'application/json' },
      ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    }),
    { params: Promise.resolve(init.params ?? {}) },
  );

const listResponse = await call(collection.GET, '/students?pageSize=2&sort=admissionNo&status=active', { user: 'admin-a' });
assert.equal(listResponse.status, 200);
const listed = ((await listResponse.json()) as { data: Page<Student> }).data;
assert.equal(listed.pageSize, 2);
assert.equal(listed.total, 3);
assert.deepEqual(listed.items.map((s) => s.admissionNo), ['A-001', 'A-002']);
ok('GET /students: query string is coerced, validated and applied');

const anonymous = await call(collection.GET, '/students');
assert.equal(anonymous.status, 401);
ok('no sign-in gives 401');

const badQuery = await call(collection.GET, '/students?sort=fatherName&page=0', { user: 'admin-a' });
assert.equal(badQuery.status, 422);
assert.deepEqual(Object.keys(((await badQuery.json()) as ApiErrorBody).error.fields ?? {}).sort(), ['page', 'sort']);
ok('a bad query string gives 422 with the offending fields');

const created = await call(collection.POST, '/students', {
  user: 'admin-a',
  method: 'POST',
  body: { ...input({ admissionNo: 'A-100', fullName: 'Hina Shah' }), id: undefined },
});
assert.equal(created.status, 201);
assert.ok(created.headers.get('x-request-id'));
const hina = ((await created.json()) as { data: Student }).data;
ok('POST /students gives 201 and the saved record');

const forbidden = await call(collection.POST, '/students', { user: 'teacher-a1', method: 'POST', body: input({ admissionNo: 'A-101' }) });
assert.equal(forbidden.status, 403);
assert.equal(((await forbidden.json()) as ApiErrorBody).error.code, 'FORBIDDEN');
ok('POST without permission gives 403');

const patched = await call(item.PATCH, `/students/${hina.id}`, {
  user: 'admin-a',
  method: 'PATCH',
  params: { id: hina.id },
  body: { version: hina.version, fatherName: 'Imran Shah' },
});
assert.equal(patched.status, 200);
assert.equal(((await patched.json()) as { data: Student }).data.fatherName, 'Imran Shah');
ok('PATCH /students/[id]');

const stale = await call(item.PATCH, `/students/${hina.id}`, {
  user: 'admin-a',
  method: 'PATCH',
  params: { id: hina.id },
  body: { version: hina.version, fatherName: 'Stale Edit' },
});
assert.equal(stale.status, 409);
assert.equal(((await stale.json()) as ApiErrorBody).error.code, 'STALE');
ok('PATCH with an old version gives 409 STALE');

const badId = await call(item.GET, '/students/not-a-uuid', { user: 'admin-a', params: { id: 'not-a-uuid' } });
assert.equal(badId.status, 422);
const missing = await call(item.GET, `/students/${randomUUID()}`, { user: 'admin-a', params: { id: randomUUID() } });
assert.equal(missing.status, 404);
ok('GET /students/[id]: bad id gives 422, unknown id gives 404');

const blocked = await call(item.DELETE, `/students/${hina.id}`, { user: 'admin-a', method: 'DELETE', params: { id: hina.id } });
assert.equal(blocked.status, 409);
assert.equal(((await blocked.json()) as ApiErrorBody).error.code, 'RULE');
await as(adminA, async (ctx) => {
  const current = await studentsDb.get(ctx, hina.id);
  await studentsDb.update(ctx, hina.id, { status: 'left' }, current.version);
});
const deleted = await call(item.DELETE, `/students/${hina.id}`, { user: 'admin-a', method: 'DELETE', params: { id: hina.id } });
assert.equal(deleted.status, 204);
ok('DELETE /students/[id]: rule gives 409, success gives 204 with no body');

// --- API client: the same calls the web and mobile apps make, sent through the real route handlers ----

console.log('api client');

configureApi({
  baseUrl: 'http://test/api/v1',
  fetch: async (url, init) => {
    const request = new Request(url, { ...init, headers: { ...(init?.headers as Record<string, string>), 'x-test-user': 'admin-a' } });
    const id = new URL(request.url).pathname.match(/^\/api\/v1\/students(?:\/([^/]+))?$/)?.[1];
    const handlers: Record<string, typeof collection.GET | undefined> = id ? item : collection;
    const handler = handlers[request.method];
    if (!handler) return new Response(null, { status: 405 });
    return handler(request, { params: Promise.resolve(id ? { id } : {}) });
  },
});

const viaClient = await studentsApi.list({ q: 'hamid', sort: 'admissionNo', pageSize: 10 });
assert.deepEqual(viaClient.items.map((s) => s.admissionNo), ['A-003']);
assert.equal(viaClient.pageSize, 10);
ok('studentsApi.list builds the query string the route expects');

const omar = await studentsApi.create(input({ admissionNo: 'A-200', fullName: 'Omar Farooq' }));
const omarRenamed = await studentsApi.update(omar.id, { version: omar.version, fullName: 'Omar Farooq Khan' });
assert.equal(omarRenamed.version, omar.version + 1);
assert.equal((await studentsApi.get(omar.id)).fullName, 'Omar Farooq Khan');
ok('studentsApi.create, update and get round-trip');

const clientError = async (work: () => Promise<unknown>) => {
  try {
    await work();
  } catch (error) {
    assert.ok(error instanceof ApiError, `expected an ApiError, got ${String(error)}`);
    return error;
  }
  assert.fail('expected the call to fail');
};

const staleError = await clientError(() => studentsApi.update(omar.id, { version: omar.version, fullName: 'Old' }));
assert.deepEqual([staleError.status, staleError.code], [409, 'STALE']);
const fieldError = await clientError(() => studentsApi.create({ ...input({ admissionNo: 'A-201' }), bFormNo: '123' }));
assert.deepEqual([fieldError.status, fieldError.code], [422, 'VALIDATION']);
assert.deepEqual(fieldError.fields, { bFormNo: ['Use the format 12345-1234567-1'] });
assert.ok(fieldError.requestId);
const ruleError = await clientError(() => studentsApi.remove(omar.id));
assert.deepEqual([ruleError.status, ruleError.code], [409, 'RULE']);
const missingError = await clientError(() => studentsApi.get(randomUUID()));
assert.deepEqual([missingError.status, missingError.code], [404, 'NOT_FOUND']);
ok('failures arrive as ApiError with the code, the per-field messages and the request id');

console.log(`\nALL ${checks} CHECKS PASSED`);
await pg.close();
