/*
 * Compares the routes in code (the route manifest) with the routes in the plan.
 *
 *   pnpm api:verify-plan                 fails on a route the plan does not have, a wrong
 *                                        permission, or a missing Idempotency-Key requirement;
 *                                        says how many planned routes are still to be written
 *   pnpm api:verify-plan --waiting       also lists every planned route that does not exist yet
 *   pnpm api:verify-plan --module M21    the same list, for one module
 *   pnpm api:verify-plan --complete      also fails while any planned route is missing
 *                                        (the exit check of Phase 2)
 *
 * Run `pnpm api:manifest` first: this reads apps/web/src/server/manifest.ts as it is.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { routeManifest } from '../src/server/manifest';

interface PlanRoute {
  method: string;
  path: string;
  permission: string;
  module: string;
  idempotent?: boolean;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const planFile = resolve(root, 'docs/plan/_tools/out/plan.json');

function loadPlan(): PlanRoute[] {
  execFileSync(
    process.execPath,
    [resolve(root, 'docs/plan/_tools/check.mjs'), '--json', '--no-write'],
    { cwd: root, stdio: 'ignore' },
  );
  if (!existsSync(planFile)) throw new Error(`The plan checker did not write ${planFile}`);
  return (JSON.parse(readFileSync(planFile, 'utf8')) as { routes: PlanRoute[] }).routes;
}

const args = process.argv.slice(2);
const complete = args.includes('--complete');
const moduleAt = args.indexOf('--module');
const onlyModule = moduleAt >= 0 ? args[moduleAt + 1]?.toUpperCase() : undefined;
const listWaiting = args.includes('--waiting') || onlyModule !== undefined;

const plan = loadPlan();
const keyOf = (route: { method: string; path: string }) => `${route.method} ${route.path}`;
const planned = new Map(plan.map((route) => [keyOf(route), route]));
const inCode = new Map(routeManifest.map((route) => [keyOf(route), route]));

const problems: string[] = [];
for (const route of routeManifest) {
  const want = planned.get(keyOf(route));
  if (!want) {
    problems.push(`${keyOf(route)}: in code but not in the plan`);
    continue;
  }
  if (want.permission !== route.access)
    problems.push(
      `${keyOf(route)}: needs "${route.access}" in code, "${want.permission}" in the plan (${want.module})`,
    );
  if (want.idempotent && !route.idempotent)
    problems.push(
      `${keyOf(route)}: the plan (${want.module}) says it is idempotent; the route does not ask for an Idempotency-Key`,
    );
}

const modules = [...new Set(plan.map((route) => route.module))].sort();
const waiting = plan.filter((route) => !inCode.has(keyOf(route)));
console.log('Module  Exist  Planned');
for (const module of modules) {
  const all = plan.filter((route) => route.module === module);
  const missing = waiting.filter((route) => route.module === module);
  if (onlyModule && module !== onlyModule) continue;
  console.log(
    `${module.padEnd(6)}  ${String(all.length - missing.length).padStart(5)}  ${String(all.length).padStart(7)}${missing.length === 0 ? '  complete' : ''}`,
  );
  if (listWaiting)
    for (const route of missing)
      console.log(`          ${route.method.padEnd(6)} ${route.path}  [${route.permission}]`);
}

const summary = `${plan.length - waiting.length} of ${plan.length} planned routes exist; ${waiting.length} wait`;
if (problems.length > 0) {
  console.error(`\n${problems.join('\n')}`);
  console.error(`\n${problems.length} difference(s). ${summary}.`);
  process.exit(1);
}
if (complete && waiting.length > 0) {
  console.error(`\nNot complete: ${summary}.`);
  process.exit(1);
}
console.log(`\nThe routes in code match the plan. ${summary}.`);
