import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  defaultPermissionsFor,
  staffRoleKeys,
  type PermissionKey,
  type RoleKey,
} from '@takhti/contracts';
import type { Actor } from '@takhti/core';
import { callRoute } from '../../helpers/http';
import { createTestDb, type TestDb } from '../../helpers/test-db';
import { seedOrg, type TestOrg } from '../../helpers/world';
import { generatedRoutes, type GeneratedRoute } from './routes.generated';

/*
 * Every route written by `pnpm scaffold:api`, called three ways through its real Route Handler:
 *
 *   with no session                         → 401
 *   as a person whose role lacks the permission → 403
 *   as a person whose role holds it         → anything but 401 and 403, and never a server error
 *
 * The third call sends nothing useful (an empty body, an id that does not exist), so it proves the
 * route is wired to its service and its permission, not that the service is right. A list is the
 * exception: it must answer 200, which runs the generated query against the real table.
 *
 * Roles and the permissions they hold by default come from the catalogue, so this test moves with
 * the plan: a permission given to a different role needs no change here.
 */

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

async function call(route: GeneratedRoute, as?: Actor) {
  const handler = (await route.load())[route.method];
  if (!handler) throw new Error(`${route.path} does not export ${route.method}`);
  const id = randomUUID();
  const onItem = route.path.includes('[id]');
  return callRoute(handler, {
    ...(as && { as }),
    method: route.method,
    url: `/api/v1${route.path.replace('[id]', id)}`,
    ...(onItem && { params: { id } }),
    ...(route.method === 'POST' && !onItem && { body: {} }),
    ...(route.method === 'PATCH' && { body: { version: 1 } }),
  });
}

const byModule = new Map<string, GeneratedRoute[]>();
for (const route of generatedRoutes) {
  const list = byModule.get(route.module) ?? [];
  list.push(route);
  byModule.set(route.module, list);
}

describe('the standard routes: who gets in', () => {
  it('there are routes to check', () => {
    expect(generatedRoutes.length).toBeGreaterThan(500);
  });

  for (const [module, routes] of byModule) {
    describe(module, () => {
      for (const route of routes) {
        it(`${route.method} ${route.path} needs ${route.permission}`, async () => {
          expect((await call(route)).status).toBe(401);

          if (route.permission !== 'signed-in') {
            // Every permission in the plan is a real one: a route cannot ask for something nobody can be given.
            expect(granted.get('owner')?.has(route.permission as PermissionKey)).toBe(true);
            // A few permissions are held by everyone, families included (the calendar, the list of
            // subjects): there is then nobody to refuse.
            const outsider = withoutPermission(route.permission);
            if (outsider)
              expect((await call(route, await school.actor(outsider))).status).toBe(403);
          }

          const role = route.permission === 'signed-in' ? 'guardian' : holderOf(route.permission);
          const allowed = await call(route, await school.actor(role));
          expect([401, 403], `${role} was refused: ${allowed.error?.message}`).not.toContain(
            allowed.status,
          );
          expect(allowed.status, allowed.error?.message).toBeLessThan(500);
          if (route.operation === 'list') expect(allowed.status, allowed.error?.message).toBe(200);
        });
      }
    });
  }
});
