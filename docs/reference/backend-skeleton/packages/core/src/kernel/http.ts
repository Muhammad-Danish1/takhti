import { z } from 'zod';
import {
  IdParams,
  type AnyResource,
  type ApiSuccessBody,
  type CreateData,
  type ListData,
  type UpdateData,
} from '@school/contracts';
import type { Actor, Ctx } from './context';
import type { CrudService } from './crud-service';
import { AppError, toErrorResponse } from './errors';

type Awaitable<T> = T | Promise<T>;
/** Second argument Next.js passes to a Route Handler. */
export type RouteContext = { params: Promise<Record<string, string | string[] | undefined>> };
export type RouteHandler = (request: Request, context: RouteContext) => Promise<Response>;

type Parsed<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface RouteSpec<P, Q, B, TResult> {
  /** Schemas for the three inputs. Whatever is given is validated before the handler runs. */
  params?: P;
  query?: Q;
  body?: B;
  /** HTTP status on success. Default 200. */
  status?: number;
  handler: (ctx: Ctx, input: { params: Parsed<P>; query: Parsed<Q>; body: Parsed<B> }) => Awaitable<TResult>;
}

/** What the host app plugs in: how to recognise the caller, and how to open the transaction. */
export interface RouteDeps {
  authenticate(request: Request): Promise<Actor>;
  run<T>(actor: Actor, meta: Pick<Ctx, 'requestId' | 'source'>, work: (ctx: Ctx) => Promise<T>): Promise<T>;
}

function json(body: unknown, status: number, requestId: string): Response {
  return Response.json(body, { status, headers: { 'x-request-id': requestId } });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError('VALIDATION', 'The request body is not valid JSON');
  }
}

/**
 * Returns the three route builders, wired to the host's sign-in and database.
 * They use only web-standard `Request` and `Response`, so the same routes run in Next.js,
 * in tests (with a fake sign-in) and on any other server.
 */
export function createRoutes(deps: RouteDeps) {
  /**
   * Builds one Route Handler. Every route in the app goes through here, so authentication,
   * validation, the database transaction and the error format are written once.
   */
  function defineRoute<
    P extends z.ZodType | undefined = undefined,
    Q extends z.ZodType | undefined = undefined,
    B extends z.ZodType | undefined = undefined,
    TResult = unknown,
  >(spec: RouteSpec<P, Q, B, TResult>): RouteHandler {
    return async (request, context) => {
      const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
      try {
        const actor = await deps.authenticate(request);

        const input = {
          params: spec.params?.parse(await context.params),
          query: spec.query?.parse(Object.fromEntries(new URL(request.url).searchParams)),
          body: spec.body?.parse(await readJson(request)),
        } as { params: Parsed<P>; query: Parsed<Q>; body: Parsed<B> };

        // One transaction per request: if the handler throws, everything it wrote is rolled back.
        const data = await deps.run(actor, { requestId, source: 'api' }, async (ctx) => spec.handler(ctx, input));

        if (data === undefined) return new Response(null, { status: 204, headers: { 'x-request-id': requestId } });
        return json({ data } satisfies ApiSuccessBody<TResult>, spec.status ?? 200, requestId);
      } catch (error) {
        const { status, body } = toErrorResponse(error, requestId);
        return json(body, status, requestId);
      }
    };
  }

  // In the two builders below the contract is generic, so TypeScript cannot see that a value parsed by
  // `contract.list` is exactly what `service.list` wants. The casts state that; module code never needs one.

  /** `GET /resource` (list) and `POST /resource` (create). */
  function collectionRoutes<R extends AnyResource>(contract: R, service: CrudService<R>) {
    return {
      GET: defineRoute({
        query: contract.list,
        handler: (ctx, { query }) => service.list(ctx, query as ListData<R>),
      }),
      POST: defineRoute({
        body: contract.create,
        status: 201,
        handler: (ctx, { body }) => service.create(ctx, body as CreateData<R>),
      }),
    };
  }

  /** `GET`, `PATCH` and `DELETE /resource/[id]`. */
  function itemRoutes<R extends AnyResource>(contract: R, service: CrudService<R>) {
    return {
      GET: defineRoute({
        params: IdParams,
        handler: (ctx, { params }) => service.get(ctx, params.id),
      }),
      PATCH: defineRoute({
        params: IdParams,
        body: contract.update,
        handler: (ctx, { params, body }) => service.update(ctx, params.id, body as UpdateData<R>),
      }),
      DELETE: defineRoute({
        params: IdParams,
        handler: (ctx, { params }) => service.remove(ctx, params.id),
      }),
    };
  }

  return { defineRoute, collectionRoutes, itemRoutes };
}
