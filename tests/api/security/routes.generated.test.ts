import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  defaultPermissionsFor,
  staffRoleKeys,
  type PermissionKey,
  type RoleKey,
} from '@takhti/contracts';
import { routeMetaOf, type Actor, type RouteHandler } from '@takhti/core';
import { routeManifest, type ManifestRoute } from '@/server/manifest';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, type TestOrg } from '../../helpers/world';
import { generatedRoutes } from './routes.generated';

/*
 * Every route in the route manifest, generated or written by hand, called through its real Route
 * Handler:
 *
 *   with no session                             → 401
 *   as a person whose role lacks the permission → 403
 *   as a person whose role holds it             → anything but 401 and 403, and never a server error
 *
 * The third call sends nothing useful (an empty body, an id that does not exist), so it proves the
 * route is wired to its service and its permission, not that the service is right. A plain list is
 * the exception: it must answer 200, which runs the generated query against the real table.
 *
 * It also holds the manifest to the code: every route file is in it, and each entry says what its
 * handler says. Run `pnpm api:manifest` when that fails.
 *
 * Roles and the permissions they hold by default come from the catalogue, so this test moves with
 * the plan: a permission given to a different role needs no change here.
 */

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../apps/web/app/api/v1');

let db: TestDb;
let school: TestOrg;
beforeAll(async () => {
  db = await createTestDb();
  school = await seedOrg();
});
afterAll(async () => {
  await db.destroy();
});

const granted = new Map<RoleKey, Set<string>>(
  ([...staffRoleKeys, 'guardian'] as RoleKey[]).map((role) => [
    role,
    new Set<string>(defaultPermissionsFor(role)),
  ]),
);
// The owner holds everything and the auditor everything that only looks, so neither says much
// about a single permission; they are tried last.
const ordinary = staffRoleKeys.filter((role) => role !== 'owner' && role !== 'auditor');
const holderOf = (permission: string): RoleKey =>
  ordinary.find((role) => granted.get(role)?.has(permission)) ?? 'owner';
// What every member of staff holds, a guardian still lacks.
const withoutPermission = (permission: string): RoleKey | undefined =>
  (
    [
      'driver',
      'security_guard',
      'librarian',
      'nurse',
      'store_keeper',
      'receptionist',
      'guardian',
    ] as const
  ).find((role) => !granted.get(role)?.has(permission));

const keyOf = (route: { method: string; path: string }) => `${route.method} ${route.path}`;
/** The plain operations written by the scaffolder: these answer to their permission alone. */
const plain = new Map(generatedRoutes.map((route) => [keyOf(route), route.operation]));
const accessWords = new Set(['signed-in', 'public', 'platform', 'webhook']);

const loaded = new Map<string, Promise<Record<string, RouteHandler | undefined>>>();
function handlerOf(route: ManifestRoute): Promise<RouteHandler | undefined> {
  let module = loaded.get(route.path);
  if (!module) {
    module = import(pathToFileURL(join(apiDir, route.path, 'route.ts')).href) as Promise<
      Record<string, RouteHandler | undefined>
    >;
    loaded.set(route.path, module);
  }
  return module.then((exported) => exported[route.method]);
}

async function call(route: ManifestRoute, as?: Actor) {
  const handler = await handlerOf(route);
  if (!handler) throw new Error(`${route.path} does not export ${route.method}`);
  // Every parameter that is an id gets one that does not exist; the others get a word.
  const params: Record<string, string> = {};
  for (const [, name] of route.path.matchAll(/\[([^\]]+)\]/g))
    params[name as string] = /id$/i.test(name as string) ? randomUUID() : 'none';
  const url = route.path.replace(/\[([^\]]+)\]/g, (_whole, name: string) => params[name] ?? '');
  const isCollection = !route.path.includes('[');
  const sendsBody =
    route.method === 'PATCH' ||
    route.method === 'PUT' ||
    (route.method === 'POST' && (isCollection || !plain.has(keyOf(route))));
  return callRoute(handler, {
    ...(as && { as }),
    method: route.method,
    url: `/api/v1${url}`,
    ...(Object.keys(params).length > 0 && { params }),
    ...(sendsBody && { body: route.method === 'PATCH' ? { version: 1 } : {} }),
    ...(route.idempotent && { headers: { 'idempotency-key': randomUUID() } }),
  });
}

function routeFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...routeFiles(path));
    else if (entry.name === 'route.ts')
      found.push(`/${relative(apiDir, dir).split('\\').join('/')}`);
  }
  return found;
}

// One group for each first word of the path, so a failure names its neighbourhood.
const groups = new Map<string, ManifestRoute[]>();
for (const route of routeManifest) {
  const group = route.path.split('/')[1] ?? '';
  const list = groups.get(group) ?? [];
  list.push(route);
  groups.set(group, list);
}

describe('every route: who gets in', () => {
  it('there are routes to check', () => {
    expect(routeManifest.length).toBeGreaterThan(500);
    expect(generatedRoutes.length).toBeGreaterThan(500);
  });

  it('every route file is in the manifest (run `pnpm api:manifest` if this fails)', () => {
    expect([...new Set(routeManifest.map((route) => route.path))].sort()).toEqual(
      routeFiles(apiDir).sort(),
    );
  });

  it('every route the scaffolder wrote is in the manifest', () => {
    const listed = new Set(routeManifest.map(keyOf));
    expect(generatedRoutes.map(keyOf).filter((key) => !listed.has(key))).toEqual([]);
  });

  for (const [group, routes] of groups) {
    describe(`/${group}`, () => {
      for (const route of routes) {
        it(`${route.method} ${route.path} needs ${route.access}`, async () => {
          // The manifest says what the handler says.
          const meta = routeMetaOf(await handlerOf(route));
          expect(
            {
              access: meta?.access,
              idempotent: meta?.idempotent,
              rateLimit: meta?.rateLimit,
            },
            'the manifest is out of date: run `pnpm api:manifest`',
          ).toEqual({
            access: route.access,
            idempotent: route.idempotent === true,
            rateLimit: route.rateLimit ?? 'standard',
          });

          if (route.access === 'public' || route.access === 'webhook') {
            // No session is needed; what the route makes of an empty request is its own test's
            // business. Here: it answers, and not with a server error.
            expect((await call(route)).status).toBeLessThan(500);
            return;
          }

          expect((await call(route)).status).toBe(401);

          if (route.access === 'platform') {
            // The owner of a school is not one of Takhti's staff.
            expect([401, 403]).toContain((await call(route, await school.actor('owner'))).status);
            return;
          }

          const isPermission = !accessWords.has(route.access);
          if (isPermission) {
            // Every permission in the plan is a real one: a route cannot ask for something nobody can be given.
            expect(granted.get('owner')?.has(route.access as PermissionKey)).toBe(true);
            // A few permissions are held by everyone, families included (the calendar, the list of
            // subjects): there is then nobody to refuse.
            const outsider = withoutPermission(route.access);
            if (outsider)
              expect((await call(route, await school.actor(outsider))).status).toBe(403);
          }

          const role = isPermission ? holderOf(route.access) : 'guardian';
          const allowed = await call(route, await school.actor(role));
          expect(allowed.status, allowed.error?.message).not.toBe(401);
          expect(allowed.status, allowed.error?.message).toBeLessThan(500);
          // A hand-written route open to every signed-in person applies its own rule about whose
          // record it is, and may refuse a guardian; everywhere else the holder is let in.
          if (isPermission || plain.has(keyOf(route)))
            expect(allowed.status, `${role} was refused: ${allowed.error?.message}`).not.toBe(403);
          if (plain.get(keyOf(route)) === 'list')
            expect(allowed.status, allowed.error?.message).toBe(200);
        });
      }
    });
  }
});
