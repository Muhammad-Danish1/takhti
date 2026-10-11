import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ensureProfile, adminDb, platformAuditLog, rooms, withAdminTx } from '@takhti/db';
import {
  createRoutes,
  rateLimited,
  rule,
  runAs,
  runAsPlatform,
  unauthenticated,
  type Actor,
  type RateLimitRule,
  type RouteHandler,
} from '@takhti/core';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, TEST_NOW, type TestOrg } from '../../helpers/world';

/*
 * The route builder itself, with a stand-in sign-in. What it does for every route is tested here once;
 * the tests of each resource then only need to prove their own rules.
 */

const ORIGIN = 'http://localhost:3000';

let db: TestDb;
let school: TestOrg;
let cashier: Actor;
let currentActor: Actor | undefined;
let bearer = false;
const hits: RateLimitRule[] = [];
let blockKey: string | undefined;
const adminUser = randomUUID();

const routes = createRoutes({
  authenticate: async () => {
    if (!currentActor) throw unauthenticated();
    return { actor: currentActor, viaBearer: bearer };
  },
  authenticateUser: async () => {
    if (!currentActor) throw unauthenticated();
    return { userId: currentActor.userId, viaBearer: bearer };
  },
  authenticatePlatform: async (request) => {
    const role = request.headers.get('x-admin');
    if (role !== 'super_admin' && role !== 'support_agent') throw unauthenticated();
    return { userId: adminUser, role };
  },
  run: runAs,
  runPlatform: runAsPlatform,
  allowedOrigins: () => [ORIGIN],
  limit: async (limitRule) => {
    hits.push(limitRule);
    if (blockKey && limitRule.key.includes(blockKey)) throw rateLimited(17);
  },
});

const call = async (
  handler: RouteHandler,
  init: {
    method?: string;
    url?: string;
    body?: unknown;
    headers?: Record<string, string>;
    params?: Record<string, string>;
  } = {},
) => {
  const method = init.method ?? 'GET';
  const request = new Request(new URL(init.url ?? '/api/v1/test', ORIGIN), {
    method,
    headers: {
      origin: ORIGIN,
      ...(init.body !== undefined && { 'content-type': 'application/json' }),
      ...init.headers,
    },
    ...(init.body !== undefined && {
      body: typeof init.body === 'string' ? init.body : JSON.stringify(init.body),
    }),
  });
  const response = await handler(request, { params: Promise.resolve(init.params ?? {}) });
  const text = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    json:
      text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : undefined,
    text,
  };
};

beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
  cashier = await school.actor('cashier');
  await withAdminTx((tx) =>
    ensureProfile(tx, {
      id: adminUser,
      fullName: 'Platform Admin',
      isPlatform: true,
      now: TEST_NOW,
    }),
  );
});
afterAll(async () => {
  await db.destroy();
});
beforeEach(() => {
  currentActor = cashier;
  bearer = false;
  hits.length = 0;
  blockKey = undefined;
});

describe('every route', () => {
  it('answers in one envelope, with a request id, and never caches', async () => {
    const handler = routes.defineRoute({
      handler: async (ctx) => ({ org: ctx.actor.orgId, source: ctx.source }),
    });
    const response = await call(handler);
    expect(response.status).toBe(200);
    expect(response.json).toEqual({ data: { org: school.orgId, source: 'api' } });
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('keeps a sensible request id given by the caller, and replaces a hostile one', async () => {
    const handler = routes.defineRoute({ handler: async (ctx) => ctx.requestId });
    expect(
      (await call(handler, { headers: { 'x-request-id': 'mobile-7f3a9c21' } })).json.data,
    ).toBe('mobile-7f3a9c21');
    const replaced = await call(handler, {
      headers: { 'x-request-id': '<script>alert(1)</script>' },
    });
    expect(replaced.json.data).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('204 when the handler returns nothing, and the chosen status otherwise', async () => {
    expect((await call(routes.defineRoute({ handler: async () => undefined }))).status).toBe(204);
    expect(
      (
        await call(routes.defineRoute({ status: 201, handler: async () => ({ id: 1 }) }), {
          method: 'POST',
        })
      ).status,
    ).toBe(201);
  });

  it('validates params, query and body before the handler runs', async () => {
    let ran = false;
    const handler = routes.defineRoute({
      params: z.object({ id: z.uuid() }),
      query: z.strictObject({ month: z.string().regex(/^\d{4}-\d{2}$/) }),
      body: z.object({ amount: z.int().min(1) }),
      handler: async () => {
        ran = true;
        return 'ok';
      },
    });
    const bad = await call(handler, {
      method: 'POST',
      url: '/api/v1/test?month=October',
      params: { id: 'x' },
      body: { amount: 0 },
    });
    expect(bad.status).toBe(422);
    expect(ran).toBe(false);
    const good = await call(handler, {
      method: 'POST',
      url: '/api/v1/test?month=2026-10',
      params: { id: randomUUID() },
      body: { amount: 5 },
    });
    expect(good.json).toEqual({ data: 'ok' });
  });

  it('refuses a body that is too large', async () => {
    const handler = routes.defineRoute({
      body: z.object({ text: z.string() }),
      maxBodyBytes: 100,
      handler: async () => 'ok',
    });
    const response = await call(handler, { method: 'POST', body: { text: 'x'.repeat(500) } });
    expect(response.status).toBe(422);
    expect(response.json.error.message).toBe('The request is too large');
  });

  it('a business rule answers 409 with its sentence; a bug answers 500 and says nothing about itself', async () => {
    const refused = await call(
      routes.defineRoute({
        handler: async () => Promise.reject(rule('This voucher is already paid')),
      }),
    );
    expect(refused.status).toBe(409);
    expect(refused.json.error).toMatchObject({
      code: 'RULE',
      message: 'This voucher is already paid',
    });

    const bug = await call(
      routes.defineRoute({
        handler: async () => {
          throw new TypeError("Cannot read properties of undefined (reading 'secretColumn')");
        },
      }),
    );
    expect(bug.status).toBe(500);
    expect(bug.json.error.code).toBe('INTERNAL');
    expect(JSON.stringify(bug.json)).not.toContain('secretColumn');
    expect(bug.json.error.requestId).toBe(bug.headers.get('x-request-id'));
  });

  it('one transaction per request: a failure after a write leaves nothing behind', async () => {
    const name = `Rolled back ${randomUUID()}`;
    const handler = routes.defineRoute({
      handler: async (ctx) => {
        await ctx.db
          .insert(rooms)
          .values({ orgId: ctx.actor.orgId, branchId: school.mainBranchId, name });
        throw rule('refused at the last step');
      },
    });
    expect((await call(handler, { method: 'POST' })).status).toBe(409);
    expect(await adminDb().select().from(rooms).where(eq(rooms.name, name))).toEqual([]);
  });

  it('a handler may answer for itself, for a download', async () => {
    const handler = routes.defineRoute({
      handler: async () =>
        new Response('a,b\r\n1,2\r\n', {
          headers: {
            'content-type': 'text/csv',
            'content-disposition': 'attachment; filename="rooms.csv"',
          },
        }),
    });
    const response = await call(handler);
    expect(response.text).toBe('a,b\r\n1,2\r\n');
    expect(response.headers.get('content-type')).toBe('text/csv');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
});

describe('origin, rate limits and sessions', () => {
  it('a changing request needs the app’s own origin, unless it carries a bearer token', async () => {
    const handler = routes.defineRoute({ handler: async () => 'done' });
    expect(
      (await call(handler, { method: 'POST', headers: { origin: 'https://evil.example' } })).status,
    ).toBe(403);
    bearer = true; // a mobile app: another site cannot make a browser send its token
    expect(
      (await call(handler, { method: 'POST', headers: { origin: 'https://evil.example' } })).status,
    ).toBe(200);
  });

  it('counts each request against the standard limit for its kind, per user', async () => {
    const handler = routes.defineRoute({ handler: async () => 'ok' });
    await call(handler);
    await call(handler, { method: 'POST' });
    expect(hits).toEqual([
      { key: `std:user:${cashier.userId}`, max: 300, windowSeconds: 60 },
      { key: `std:user:${cashier.userId}`, max: 120, windowSeconds: 60 },
    ]);
  });

  it('a route’s own limit is counted for that route alone, and can be by address or by school', async () => {
    const handler = routes.defineRoute({
      rateLimit: { max: 10, windowSeconds: 60, by: 'org' },
      handler: async () => 'ok',
    });
    await call(handler, { method: 'POST', url: '/api/v1/exports' });
    expect(hits).toEqual([
      { key: `POST /api/v1/exports:org:${school.orgId}`, max: 10, windowSeconds: 60 },
    ]);
  });

  it('429 with retry-after when over the limit, before the handler runs', async () => {
    let ran = false;
    blockKey = cashier.userId;
    const handler = routes.defineRoute({
      handler: async () => {
        ran = true;
      },
    });
    const response = await call(handler);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('17');
    expect(response.json.error.code).toBe('RATE_LIMITED');
    expect(ran).toBe(false);
  });

  it('401 without a session, for a member route and for a signed-in-person route', async () => {
    currentActor = undefined;
    expect((await call(routes.defineRoute({ handler: async () => 'x' }))).status).toBe(401);
    expect((await call(routes.defineUserRoute({ handler: async () => 'x' }))).status).toBe(401);
  });

  it('a signed-in-person route knows the user and opens no transaction of its own', async () => {
    const handler = routes.defineUserRoute({ handler: async (user) => ({ userId: user.userId }) });
    expect((await call(handler)).json).toEqual({ data: { userId: cashier.userId } });
  });
});

describe('idempotent routes', () => {
  const collect = () => {
    let runs = 0;
    const handler = routes.defineRoute({
      idempotent: true,
      status: 201,
      body: z.object({ amount: z.int() }),
      handler: async (ctx, { body }) => {
        runs += 1;
        await ctx.db.insert(rooms).values({
          orgId: ctx.actor.orgId,
          branchId: school.mainBranchId,
          name: `Receipt ${randomUUID()}`,
        });
        return { receipt: runs, amount: body.amount };
      },
    });
    return { handler, runs: () => runs };
  };

  it('needs the header, in a sensible form', async () => {
    const { handler } = collect();
    expect((await call(handler, { method: 'POST', body: { amount: 1 } })).status).toBe(422);
    expect(
      (
        await call(handler, {
          method: 'POST',
          body: { amount: 1 },
          headers: { 'idempotency-key': 'short' },
        })
      ).status,
    ).toBe(422);
  });

  it('a repeat returns the first answer, marked as a replay, and the work ran once', async () => {
    const { handler, runs } = collect();
    const key = randomUUID();
    const first = await call(handler, {
      method: 'POST',
      body: { amount: 12_500 },
      headers: { 'idempotency-key': key },
    });
    const second = await call(handler, {
      method: 'POST',
      body: { amount: 12_500 },
      headers: { 'idempotency-key': key },
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.json).toEqual(first.json);
    expect(first.headers.get('idempotent-replayed')).toBeNull();
    expect(second.headers.get('idempotent-replayed')).toBe('true');
    expect(runs()).toBe(1);
  });

  it('the same key with a different body is refused', async () => {
    const { handler } = collect();
    const key = randomUUID();
    await call(handler, {
      method: 'POST',
      body: { amount: 100 },
      headers: { 'idempotency-key': key },
    });
    const response = await call(handler, {
      method: 'POST',
      body: { amount: 999 },
      headers: { 'idempotency-key': key },
    });
    expect(response.status).toBe(409);
    expect(response.json.error.code).toBe('CONFLICT');
  });

  it('a request refused by a rule stores nothing, so the corrected request goes through', async () => {
    let allow = false;
    const handler = routes.defineRoute({
      idempotent: true,
      handler: async () => {
        if (!allow) throw rule('The cash session is closed');
        return 'collected';
      },
    });
    const key = randomUUID();
    expect(
      (await call(handler, { method: 'POST', headers: { 'idempotency-key': key } })).status,
    ).toBe(409);
    allow = true;
    const retry = await call(handler, { method: 'POST', headers: { 'idempotency-key': key } });
    expect(retry.json).toEqual({ data: 'collected' });
    expect(retry.headers.get('idempotent-replayed')).toBeNull();
  });
});

describe('platform and public routes', () => {
  it('a platform route runs with full reach and is always written to the platform audit log', async () => {
    const handler = routes.definePlatformRoute({
      action: 'org.rooms.count',
      params: z.object({ orgId: z.uuid() }),
      targetOrgId: ({ params }) => params.orgId,
      handler: async (ctx, { params }) =>
        (await ctx.db.select().from(rooms).where(eq(rooms.orgId, params.orgId))).length,
    });
    const response = await call(handler, {
      headers: { 'x-admin': 'support_agent' },
      params: { orgId: school.orgId },
    });
    expect(response.status).toBe(200);
    const logged = await adminDb()
      .select()
      .from(platformAuditLog)
      .where(eq(platformAuditLog.action, 'org.rooms.count'));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      adminUserId: adminUser,
      targetOrgId: school.orgId,
      requestId: response.headers.get('x-request-id'),
    });
  });

  it('a school’s own staff cannot use a platform route, and a support agent cannot use a super-admin one', async () => {
    const handler = routes.definePlatformRoute({
      action: 'plan.change',
      superAdminOnly: true,
      handler: async () => 'changed',
    });
    expect((await call(handler, { method: 'POST' })).status).toBe(401);
    expect(
      (await call(handler, { method: 'POST', headers: { 'x-admin': 'support_agent' } })).status,
    ).toBe(403);
    expect(
      (await call(handler, { method: 'POST', headers: { 'x-admin': 'super_admin' } })).status,
    ).toBe(200);
  });

  it('a public form needs no session, is limited by address, and must come from the app', async () => {
    const handler = routes.definePublicRoute({
      kind: 'page',
      body: z.object({ schoolName: z.string().min(2) }),
      status: 201,
      handler: async (_context, { body }) => ({ received: body.schoolName }),
    });
    currentActor = undefined;
    const response = await call(handler, {
      method: 'POST',
      url: '/api/v1/demo-requests',
      body: { schoolName: 'Al-Noor Grammar School' },
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    });
    expect(response.status).toBe(201);
    expect(hits).toEqual([{ key: 'std:ip:203.0.113.9', max: 10, windowSeconds: 3600 }]);
    expect(
      (
        await call(handler, {
          method: 'POST',
          body: { schoolName: 'X Y' },
          headers: { origin: 'https://evil.example' },
        })
      ).status,
    ).toBe(403);
  });

  it('a webhook needs no origin and receives the raw body for its signature check', async () => {
    const handler = routes.definePublicRoute({
      kind: 'webhook',
      raw: true,
      handler: async (context) => ({ length: context.rawBody.length, exact: context.rawBody }),
    });
    currentActor = undefined;
    const raw = '{"eventId":"evt_1",  "amount":12500}';
    const request = new Request(`${ORIGIN}/api/v1/webhooks/payments/fake`, {
      method: 'POST',
      body: raw,
      headers: { 'content-type': 'application/json' },
    });
    const response = await handler(request, { params: Promise.resolve({}) });
    expect(await response.json()).toEqual({ data: { length: raw.length, exact: raw } });
  });
});
