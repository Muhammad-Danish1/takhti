#!/usr/bin/env node
// Says which rules, failure cases and listed tests of the plan have no test named after them.
//
//   pnpm plan:coverage                 a count for every module, and whether any test names an id
//                                      the plan does not have (that fails the run)
//   pnpm plan:coverage --missing       also lists every id without a test
//   pnpm plan:coverage --module M21    the same list, for one module
//   pnpm plan:coverage --complete      also fails while any id has no test (the exit check of Phase 2)
//
// An id is covered when the name of a test, or of a group of tests, starts with it:
//
//   it('R-fees-12 a paid voucher cannot be cancelled', …)
//   describe('T-fees-7 fines', …)
//   it('R-org-3 / F-org-6: the code is fixed once a number is issued', …)
//
// Run from the repository root.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const planFile = join(here, 'out', 'plan.json');

const args = process.argv.slice(2);
const complete = args.includes('--complete');
const moduleAt = args.indexOf('--module');
const onlyModule = moduleAt >= 0 ? args[moduleAt + 1]?.toUpperCase() : undefined;
const listMissing = args.includes('--missing') || onlyModule !== undefined;

execFileSync(process.execPath, [join(here, 'check.mjs'), '--json', '--no-write'], { cwd: root, stdio: 'ignore' });
if (!existsSync(planFile)) throw new Error(`The plan checker did not write ${planFile}`);
const plan = JSON.parse(readFileSync(planFile, 'utf8'));

// ---- which module owns each id: the spec file it is written in
const moduleOf = new Map();
const modulesDir = resolve(here, '..', '10-modules');
for (const file of readdirSync(modulesDir).filter((name) => /^m\d\d-.*\.md$/.test(name)).sort()) {
  const code = file.slice(0, 3).toUpperCase();
  for (const match of readFileSync(join(modulesDir, file), 'utf8').matchAll(/^- \*\*([RFT]-[a-z]+-\d+[a-z]?)\*\*/gm)) {
    moduleOf.set(match[1], code);
  }
}

// ---- the names of the tests in code
const testFiles = [];
const walk = (dir) => {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.test\.tsx?$/.test(entry.name)) testFiles.push(path);
  }
};
for (const dir of ['tests', 'packages', 'apps']) walk(join(root, dir));

const id = '[RFT]-[a-z]+-\\d+[a-z]?';
// The start of a test's name: `it('`, `test.each(…)('`, `describe("`, `it.skip(\``.
const title = new RegExp(`\\b(?:it|test|describe)(?:\\.[a-z]+)*(?:\\([^()]*\\))?\\(\\s*['"\`]((?:${id})(?:\\s*(?:,|/|and|&|\\+)\\s*(?:${id}))*)`, 'g');
const covered = new Map(); // id → first file that names it
for (const file of testFiles) {
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(title)) {
    for (const found of match[1].match(new RegExp(id, 'g'))) {
      if (!covered.has(found)) covered.set(found, relative(root, file).split('\\').join('/'));
    }
  }
}

const planned = new Set(plan.ids);
const unknown = [...covered].filter(([found]) => !planned.has(found));
const kinds = { R: 'rules', F: 'failure cases', T: 'listed tests' };

const modules = [...new Set(moduleOf.values())].sort();
let missingTotal = 0;
console.log('Module  Rules      Failures   Tests');
for (const code of modules) {
  const mine = plan.ids.filter((planId) => moduleOf.get(planId) === code);
  const missing = mine.filter((planId) => !covered.has(planId));
  missingTotal += missing.length;
  if (onlyModule && code !== onlyModule) continue;
  const cell = (letter) => {
    const all = mine.filter((planId) => planId.startsWith(letter));
    return `${all.filter((planId) => covered.has(planId)).length}/${all.length}`.padEnd(9);
  };
  console.log(`${code.padEnd(6)}  ${cell('R')}  ${cell('F')}  ${cell('T')}${missing.length === 0 && mine.length > 0 ? '  complete' : ''}`);
  if (listMissing && missing.length > 0) console.log(`          ${missing.join(', ')}`);
}

const total = (letter) => plan.ids.filter((planId) => planId.startsWith(letter));
const summary = Object.entries(kinds)
  .map(([letter, word]) => `${total(letter).filter((planId) => covered.has(planId)).length} of ${total(letter).length} ${word}`)
  .join(', ');

if (unknown.length > 0) {
  console.error(`\n${unknown.map(([found, file]) => `${found}: named by a test in ${file}, but the plan has no such id`).join('\n')}`);
  console.error(`\n${unknown.length} test name(s) refer to an id the plan does not have.`);
  process.exit(1);
}
console.log(`\nNamed tests exist for ${summary}. ${missingTotal} id(s) have none.`);
if (complete && missingTotal > 0) process.exit(1);
