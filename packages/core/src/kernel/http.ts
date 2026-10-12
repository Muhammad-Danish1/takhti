import { z } from 'zod';
import {
  IdParams,
  type AnyResource,
  type ApiSuccessBody,
  type BulkResult,
  type CreateData,
  type EntityOf,
  type ListData,
  type UpdateData,
} from '@takhti/contracts';
import type { Actor, Ctx, PlatformAction, PlatformAdmin, RunMeta } from './context';
import { SIGNED_IN, type CrudService } from './crud-service';
import { AppError, forbidden, invalid, toErrorResponse, unauthenticated } from './errors';
import { MAX_BULK_ITEMS } from './bulk';
import { assertIdempotencyKey, hashRequest, withIdempotency } from './idempotency';
import { isUuid, newRequestId } from './ids';
import { logger } from './logger';
import { limit, standardLimits, type RateLimitRule } from './rate-limit';
import { hasBranch } from './scope';

/*
 * Layer 5. Every route in the app is built here, so authentication, the origin check, rate limits,
 * validation, the one-transaction-per-request rule, idempotency and the error format are written once.
 *
 * It uses only the web-standard `Request` and `Response`, so the same routes run in Next.js,
 * in tests (with a stand-in sign-in) and on any other server.
 *
 * Four builders, one per kind of caller:
 *   defineRoute          a signed-in member of a school (the default; nearly every route)
 *   defineUserRoute      a signed-in person who has not chosen a school yet (`/me/memberships`)
 *   definePlatformRoute  Takhti's own staff, always recorded in the platform audit log
 *   definePublicRoute    no session: public pages and forms, and webhooks from outside systems
 */

type Awaitable<T> = T | Promise<T>;
/** Second argument Next.js passes to a Route Handler. */
export type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };
export type RouteHandler = (request: Request, context: RouteContext) => Promise<Response>;

type Parsed<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface RouteInput<P, Q, B> {
  params: Parsed<P>;
  query: Parsed<Q>;
  body: Parsed<B>;
  request: Request;
}

export interface RateLimitSpec {
  max: number;
  windowSeconds: number;
  /** What the limit counts against. */
  by: 'user' | 'ip' | 'org';
}

interface CommonSpec<P, Q, B> {
  /** Schemas for the three inputs. Whatever is given is validated before the handler runs. */
  params?: P;
  query?: Q;
  body?: B;
  /** HTTP status on success. Default 200; 204 when the handler returns nothing. */
  status?: number;
  /** Replaces the standard limit for this kind of route. `false` switches limiting off. */
  rateLimit?: RateLimitSpec | false;
  /** The largest request body accepted, in bytes. Default 1 MB. */
  maxBodyBytes?: number;
}

export interface RouteSpec<P, Q, B, TResult> extends CommonSpec<P, Q, B> {
  /**
   * The permission the route needs, or `signed-in` for any member of the school. It is checked as
   * soon as the caller is known and before the request is read, so a person without access is told
   * exactly that and learns nothing about what the route would have made of their input.
   * The service checks again: this is the earlier of two checks, never the only one.
   */
  permission?: string | undefined;
  /**
   * Requires an `Idempotency-Key` header. A repeat of the same request returns the first response
   * instead of running again. For anything that must not happen twice: payments, postings, sends.
   */
  idempotent?: boolean;
  /** Where the call comes from. The sync upload sets `sync`; AI tools set `ai`. Default `api`. */
  source?: Ctx['source'];
  handler: (ctx: Ctx, input: RouteInput<P, Q, B>) => Awaitable<TResult>;
}

/** What a route for a signed-in person without a chosen school is given. */
export interface UserRouteContext {
  userId: string;
  requestId: string;
  request: Request;
}

export interface UserRouteSpec<P, Q, B, TResult> extends CommonSpec<P, Q, B> {
  handler: (user: UserRouteContext, input: RouteInput<P, Q, B>) => Awaitable<TResult>;
}

export interface PlatformRouteSpec<P, Q, B, TResult> extends CommonSpec<P, Q, B> {
  /** Recorded in the platform audit log, for example `org.suspend`. */
  action: string;
  /** Only a super admin may call it. Default: any platform admin. */
  superAdminOnly?: boolean;
  /** The school being acted on, when the route is about one. */
  targetOrgId?: (input: RouteInput<P, Q, B>) => string | undefined;
  handler: (ctx: Ctx, input: RouteInput<P, Q, B>) => Awaitable<TResult>;
}

export interface PublicRouteContext {
  requestId: string;
  ip: string;
  request: Request;
  /** The request body exactly as it arrived, for checking a webhook's signature. Only with `raw: true`. */
  rawBody: string;
}

export interface PublicRouteSpec<P, Q, B, TResult> extends CommonSpec<P, Q, B> {
  /**
   * `page`: a public page or form of the product; a browser must send it from the app's own origin.
   * `webhook`: a call from an outside system, which proves itself with a signature the handler checks.
   */
  kind: 'page' | 'webhook';
  /** Keep the raw body for a signature check. */
  raw?: boolean;
  handler: (context: PublicRouteContext, input: RouteInput<P, Q, B>) => Awaitable<TResult>;
}

/**
 * What a route says about itself. The route manifest (`pnpm api:manifest`) is built from this, and
 * with it the comparison with the plan and the test that calls every route.
 */
export interface RouteMeta {
  /**
   * The cell of the plan's route table this route answers to: a permission key, or `signed-in`
   * (any signed-in person), `public`, `platform` or `webhook`. Undefined when a route for members
   * of a school names no permission, which the manifest refuses.
   */
  access: string | undefined;
  /** Which builder made it. */
  caller: 'member' | 'user' | 'platform' | 'public';
  idempotent: boolean;
  /** The route's own limit, or `standard` for the limit shared by routes of its kind, or `none`. */
  rateLimit: RateLimitSpec | 'standard' | 'none';
}

const ROUTE_META = Symbol.for('takhti.route-meta');

function describe<P, Q, B>(
  handler: RouteHandler,
  spec: CommonSpec<P, Q, B>,
  meta: Pick<RouteMeta, 'access' | 'caller'> & { idempotent?: boolean },
): RouteHandler {
  const full: RouteMeta = {
    access: meta.access,
    caller: meta.caller,
    idempotent: meta.idempotent === true,
    rateLimit:
      spec.rateLimit === false ? 'none' : spec.rateLimit ? { ...spec.rateLimit } : 'standard',
  };
  Object.defineProperty(handler, ROUTE_META, { value: Object.freeze(full) });
  return handler;
}

/** What a handler built by `createRoutes` says about itself; undefined for any other function. */
export function routeMetaOf(handler: unknown): RouteMeta | undefined {
  if (typeof handler !== 'function') return undefined;
  return (handler as unknown as Record<symbol, RouteMeta | undefined>)[ROUTE_META];
}

export interface MemberSession {
  actor: Actor;
  /** True when the caller proved itself with a bearer token rather than the browser's cookie. */
  viaBearer?: boolean;
}

/** What the host app plugs in: how to recognise each kind of caller, and how to open the transaction. */
export interface RouteDeps {
  /** A signed-in member with a chosen school. Throws `UNAUTHENTICATED` or `FORBIDDEN`. */
  authenticate(request: Request): Promise<MemberSession>;
  /** A signed-in person, school or not. */
  authenticateUser?(request: Request): Promise<{ userId: string; viaBearer?: boolean }>;
  /** One of Takhti's own staff, with two-factor sign-in passed. */
  authenticatePlatform?(request: Request): Promise<PlatformAdmin>;
  run<T>(actor: Actor, meta: RunMeta, work: (ctx: Ctx) => Promise<T>): Promise<T>;
  runPlatform?<T>(
    admin: PlatformAdmin,
    action: PlatformAction,
    work: (ctx: Ctx) => Promise<T>,
  ): Promise<T>;
  /** Origins a browser may send a changing request from: the app's own address. */
  allowedOrigins(): readonly string[];
  /** Counts a hit and throws `RATE_LIMITED` when over. Defaults to the kernel's limiter. */
  limit?(rule: RateLimitRule): Promise<void>;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const DEFAULT_MAX_BODY = 1024 * 1024;

function withRequestId(response: Response, requestId: string): Response {
  response.headers.set('x-request-id', requestId);
  return response;
}

function json(
  body: unknown,
  status: number,
  requestId: string,
  headers: Record<string, string> = {},
): Response {
  return Response.json(body, {
    status,
    headers: { 'x-request-id': requestId, 'cache-control': 'no-store', ...headers },
  });
}

/** The caller's address as the proxy reports it. Used only for rate limits and the audit trail. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

function incomingRequestId(request: Request): string {
  const given = request.headers.get('x-request-id');
  return given && /^[A-Za-z0-9_-]{8,64}$/.test(given) ? given : newRequestId();
}

async function readBody(request: Request, maxBytes: number): Promise<string> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new AppError('VALIDATION', 'The request is too large');
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes)
    throw new AppError('VALIDATION', 'The request is too large');
  return text;
}

function parseJson(text: string): unknown {
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('VALIDATION', 'The request body is not valid JSON');
  }
}

/**
 * A browser attaches the session cookie to any request, including one a hostile page makes.
 * So a changing request that relies on the cookie must come from the app's own origin.
 * A request carrying a bearer token is not at risk: another site cannot make a browser send one.
 */
function assertSameOrigin(request: Request, allowed: readonly string[], viaBearer: boolean): void {
  if (SAFE_METHODS.has(request.method) || viaBearer) return;
  const origin = request.headers.get('origin');
  if (!origin || !allowed.includes(origin)) {
    throw forbidden('This request did not come from the app. Reload the page and try again.');
  }
}

export function createRoutes(deps: RouteDeps) {
  const hit = deps.limit ?? limit;

  async function applyLimit(
    spec: RateLimitSpec | false | undefined,
    fallback: RateLimitSpec,
    subject: { user?: string; org?: string; ip: string },
    route: string,
  ) {
    if (spec === false) return;
    const chosen = spec ?? fallback;
    const who =
      chosen.by === 'user' ? subject.user : chosen.by === 'org' ? subject.org : subject.ip;
    // A standard limit is shared by all routes of its kind; a route's own limit counts that route alone.
    const scope = spec ? route : 'std';
    await hit({
      key: `${scope}:${chosen.by}:${who ?? subject.ip}`,
      max: chosen.max,
      windowSeconds: chosen.windowSeconds,
    });
  }

  async function parseInput<P, Q, B>(
    spec: CommonSpec<P, Q, B>,
    request: Request,
    context: RouteContext,
    rawBody?: string,
  ): Promise<RouteInput<P, Q, B>> {
    const schema = <S>(candidate: S) => candidate as unknown as z.ZodType | undefined;
    const params = schema(spec.params)?.parse(await context.params);
    const query = schema(spec.query)?.parse(Object.fromEntries(new URL(request.url).searchParams));
    let body: unknown;
    const bodySchema = schema(spec.body);
    if (bodySchema) {
      const text = rawBody ?? (await readBody(request, spec.maxBodyBytes ?? DEFAULT_MAX_BODY));
      body = bodySchema.parse(parseJson(text));
    }
    return { params, query, body, request } as RouteInput<P, Q, B>;
  }

  function respond(
    data: unknown,
    status: number | undefined,
    requestId: string,
    headers: Record<string, string> = {},
  ): Response {
    // A handler may answer for itself, for a file download or a stream.
    if (data instanceof Response) return withRequestId(data, requestId);
    if (data === undefined)
      return new Response(null, {
        status: 204,
        headers: { 'x-request-id': requestId, ...headers },
      });
    return json({ data } satisfies ApiSuccessBody<unknown>, status ?? 200, requestId, headers);
  }

  function fail(error: unknown, requestId: string, request: Request): Response {
    const reply = toErrorResponse(error, requestId);
    if (reply.unexpected) {
      logger().error(
        { requestId, method: request.method, path: new URL(request.url).pathname, err: error },
        'unhandled error in a route',
      );
    }
    return json(
      reply.body,
      reply.status,
      requestId,
      reply.retryAfterSeconds === undefined
        ? {}
        : { 'retry-after': String(reply.retryAfterSeconds) },
    );
  }

  /** A route for a signed-in member of a school. One transaction per request, inside row-level security. */
  function defineRoute<
    P extends z.ZodType | undefined = undefined,
    Q extends z.ZodType | undefined = undefined,
    B extends z.ZodType | undefined = undefined,
    TResult = unknown,
  >(spec: RouteSpec<P, Q, B, TResult>): RouteHandler {
    const handler: RouteHandler = async (request, context) => {
      const requestId = incomingRequestId(request);
      try {
        const session = await deps.authenticate(request);
        const { actor } = session;
        assertSameOrigin(request, deps.allowedOrigins(), session.viaBearer === true);

        const ip = clientIp(request);
        const route = `${request.method} ${new URL(request.url).pathname}`;
        const standard = SAFE_METHODS.has(request.method)
          ? standardLimits.read
          : standardLimits.write;
        await applyLimit(
          spec.rateLimit,
          { ...standard, by: 'user' },
          { user: actor.userId, org: actor.orgId, ip },
          route,
        );

        if (
          spec.permission !== undefined &&
          spec.permission !== SIGNED_IN &&
          !actor.permissions.has(spec.permission)
        ) {
          throw forbidden(
            'You do not have access to do this. Ask an administrator of your school to grant it.',
          );
        }

        const idempotencyKey = spec.idempotent
          ? assertIdempotencyKey(request.headers.get('idempotency-key'))
          : undefined;
        const input = await parseInput(spec, request, context);

        const branchHeader = request.headers.get('x-branch-id');
        let branchId: string | undefined;
        if (branchHeader) {
          if (!isUuid(branchHeader))
            throw invalid({ 'x-branch-id': ['Not a branch id'] }, 'The chosen branch is not valid');
          if (
            actor.kind === 'staff' &&
            !actor.allBranches &&
            !actor.branchIds.includes(branchHeader)
          ) {
            throw forbidden('You do not have access to this branch');
          }
          branchId = branchHeader;
        }
        const userAgent = request.headers.get('user-agent');
        const deviceId = request.headers.get('x-device-id');
        const meta: RunMeta = {
          requestId,
          source: spec.source ?? 'api',
          ip,
          ...(branchId && { branchId }),
          ...(userAgent && { userAgent }),
          ...(deviceId && isUuid(deviceId) && { deviceId }),
        };

        // One transaction per request: if the handler throws, everything it wrote is rolled back.
        const outcome = await deps.run(actor, meta, async (ctx) => {
          if (branchId && !hasBranch(ctx, branchId) && actor.kind === 'staff')
            throw forbidden('You do not have access to this branch');
          if (!idempotencyKey)
            return {
              data: await spec.handler(ctx, input),
              replayed: false,
              status: undefined as number | undefined,
            };

          const stored = await withIdempotency(
            ctx,
            {
              key: idempotencyKey,
              route,
              requestHash: hashRequest(request.method, route, [
                input.params,
                input.query,
                input.body,
              ]),
            },
            async () => {
              const data = await spec.handler(ctx, input);
              if (data instanceof Response)
                throw new Error('An idempotent route must return data, not a Response');
              return {
                status: data === undefined ? 204 : (spec.status ?? 200),
                body: data ?? null,
              };
            },
          );
          return {
            data: stored.status === 204 ? undefined : stored.body,
            replayed: stored.replayed,
            status: stored.status,
          };
        });

        return respond(
          outcome.data,
          outcome.status ?? spec.status,
          requestId,
          outcome.replayed ? { 'idempotent-replayed': 'true' } : {},
        );
      } catch (error) {
        return fail(error, requestId, request);
      }
    };
    return describe(handler, spec, {
      access: spec.permission,
      caller: 'member',
      idempotent: spec.idempotent === true,
    });
  }

  /** A route for a signed-in person who has no school chosen yet. The handler opens its own unit of work if it needs one. */
  function defineUserRoute<
    P extends z.ZodType | undefined = undefined,
    Q extends z.ZodType | undefined = undefined,
    B extends z.ZodType | undefined = undefined,
    TResult = unknown,
  >(spec: UserRouteSpec<P, Q, B, TResult>): RouteHandler {
    const handler: RouteHandler = async (request, context) => {
      const requestId = incomingRequestId(request);
      try {
        if (!deps.authenticateUser) throw new Error('This app has no authenticateUser');
        const user = await deps.authenticateUser(request);
        assertSameOrigin(request, deps.allowedOrigins(), user.viaBearer === true);
        const standard = SAFE_METHODS.has(request.method)
          ? standardLimits.read
          : standardLimits.write;
        await applyLimit(
          spec.rateLimit,
          { ...standard, by: 'user' },
          { user: user.userId, ip: clientIp(request) },
          `${request.method} ${new URL(request.url).pathname}`,
        );
        const input = await parseInput(spec, request, context);
        return respond(
          await spec.handler({ userId: user.userId, requestId, request }, input),
          spec.status,
          requestId,
        );
      } catch (error) {
        return fail(error, requestId, request);
      }
    };
    return describe(handler, spec, { access: SIGNED_IN, caller: 'user' });
  }

  /** A route for Takhti's own staff. Runs on the privileged connection and is always recorded. */
  function definePlatformRoute<
    P extends z.ZodType | undefined = undefined,
    Q extends z.ZodType | undefined = undefined,
    B extends z.ZodType | undefined = undefined,
    TResult = unknown,
  >(spec: PlatformRouteSpec<P, Q, B, TResult>): RouteHandler {
    const handler: RouteHandler = async (request, context) => {
      const requestId = incomingRequestId(request);
      try {
        if (!deps.authenticatePlatform || !deps.runPlatform)
          throw new Error('This app has no platform sign-in');
        const admin = await deps.authenticatePlatform(request);
        assertSameOrigin(request, deps.allowedOrigins(), false);
        if (spec.superAdminOnly && admin.role !== 'super_admin')
          throw forbidden('Only a super admin can do this');
        const ip = clientIp(request);
        const standard = SAFE_METHODS.has(request.method)
          ? standardLimits.read
          : standardLimits.write;
        await applyLimit(
          spec.rateLimit,
          { ...standard, by: 'user' },
          { user: admin.userId, ip },
          spec.action,
        );
        const input = await parseInput(spec, request, context);
        const targetOrgId = spec.targetOrgId?.(input);
        const userAgent = request.headers.get('user-agent');
        const data = await deps.runPlatform(
          admin,
          {
            action: spec.action,
            requestId,
            ip,
            ...(targetOrgId && { targetOrgId }),
            ...(userAgent && { userAgent }),
          },
          (ctx) => Promise.resolve(spec.handler(ctx, input)),
        );
        return respond(data, spec.status, requestId);
      } catch (error) {
        return fail(error, requestId, request);
      }
    };
    return describe(handler, spec, { access: 'platform', caller: 'platform' });
  }

  /** A route with no session: a public page or form, or a webhook. Always limited by address. */
  function definePublicRoute<
    P extends z.ZodType | undefined = undefined,
    Q extends z.ZodType | undefined = undefined,
    B extends z.ZodType | undefined = undefined,
    TResult = unknown,
  >(spec: PublicRouteSpec<P, Q, B, TResult>): RouteHandler {
    const handler: RouteHandler = async (request, context) => {
      const requestId = incomingRequestId(request);
      try {
        if (spec.kind === 'page') assertSameOrigin(request, deps.allowedOrigins(), false);
        const ip = clientIp(request);
        const path = new URL(request.url).pathname;
        // A webhook is limited generously (the sender retries on its own schedule); a public form strictly.
        const fallback: RateLimitSpec =
          spec.kind === 'webhook'
            ? { max: 600, windowSeconds: 60, by: 'ip' }
            : SAFE_METHODS.has(request.method)
              ? { ...standardLimits.read, by: 'ip' }
              : { ...standardLimits.publicForm, by: 'ip' };
        await applyLimit(spec.rateLimit, fallback, { ip }, `${request.method} ${path}`);
        const needsBody = spec.raw || spec.body !== undefined;
        const rawBody = needsBody
          ? await readBody(request, spec.maxBodyBytes ?? DEFAULT_MAX_BODY)
          : '';
        const input = await parseInput(spec, request, context, rawBody);
        return respond(
          await spec.handler({ requestId, ip, request, rawBody }, input),
          spec.status,
          requestId,
        );
      } catch (error) {
        return fail(error, requestId, request);
      }
    };
    return describe(handler, spec, {
      access: spec.kind === 'webhook' ? 'webhook' : 'public',
      caller: 'public',
    });
  }

  // In the builders below the contract is generic, so TypeScript cannot see that a value parsed by
  // `contract.list` is exactly what `service.list` wants. The casts state that; module code never needs one.

  /** `GET /resource` (list) and `POST /resource` (create). */
  function collectionRoutes<R extends AnyResource>(contract: R, service: CrudService<R>) {
    return {
      GET: defineRoute({
        permission: service.permissions.list || undefined,
        query: contract.list,
        handler: (ctx, { query }) => service.list(ctx, query as ListData<R>),
      }),
      POST: defineRoute({
        permission: service.permissions.create || undefined,
        body: contract.create,
        status: 201,
        idempotent: contract.idempotentCreate === true,
        handler: (ctx, { body }) => service.create(ctx, body as CreateData<R>),
      }),
    };
  }

  /** `GET`, `PATCH` and `DELETE /resource/[id]`. */
  function itemRoutes<R extends AnyResource>(contract: R, service: CrudService<R>) {
    return {
      GET: defineRoute({
        permission: service.permissions.get || undefined,
        params: IdParams,
        handler: (ctx, { params }) => service.get(ctx, params.id),
      }),
      PATCH: defineRoute({
        permission: service.permissions.update || undefined,
        params: IdParams,
        body: contract.update,
        handler: (ctx, { params, body }) => service.update(ctx, params.id, body as UpdateData<R>),
      }),
      DELETE: defineRoute({
        permission: service.permissions.delete || undefined,
        params: IdParams,
        handler: (ctx, { params }) => service.remove(ctx, params.id),
      }),
    };
  }

  /** `POST /resource/[id]/restore`. */
  function restoreRoute<R extends AnyResource>(_contract: R, service: CrudService<R>) {
    return {
      POST: defineRoute({
        permission: service.permissions.restore || undefined,
        params: IdParams,
        handler: (ctx, { params }) => service.restore(ctx, params.id),
      }),
    };
  }

  /** `POST /resource/bulk`: many creates in one call, answered per item. */
  function bulkRoute<R extends AnyResource>(contract: R, service: CrudService<R>) {
    return {
      POST: defineRoute({
        permission: service.permissions.create || undefined,
        body: z.object({ items: z.array(contract.create).min(1).max(MAX_BULK_ITEMS) }),
        rateLimit: { ...standardLimits.heavy, by: 'user' },
        maxBodyBytes: 5 * DEFAULT_MAX_BODY,
        handler: (ctx, { body }): Promise<BulkResult<EntityOf<R>>> =>
          service.createMany(ctx, body.items as CreateData<R>[]),
      }),
    };
  }

  return {
    defineRoute,
    defineUserRoute,
    definePlatformRoute,
    definePublicRoute,
    collectionRoutes,
    itemRoutes,
    restoreRoute,
    bulkRoute,
  };
}

export { unauthenticated };
