#!/usr/bin/env node
// Checks the plan for broken references and writes the generated index files.
// Run from the repository root:  node docs/plan/_tools/check.mjs   (or: pnpm plan:check)
// Exit code 1 when any error is found. Warnings do not fail the run.

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const planDir = resolve(here, '..');
const modulesDir = join(planDir, '10-modules');
const refDir = join(planDir, '30-reference');
const writeIndexes = !process.argv.includes('--no-write');

const ROLE_KEYS = [
  'super_admin', 'support_agent', 'owner', 'director', 'finance_head', 'academic_head', 'auditor',
  'principal', 'vice_principal', 'branch_admin', 'section_head', 'coordinator', 'exam_controller',
  'class_teacher', 'subject_teacher', 'counsellor', 'accountant', 'cashier', 'hr_manager',
  'payroll_officer', 'admissions_officer', 'receptionist', 'librarian', 'transport_manager', 'driver',
  'store_keeper', 'nurse', 'hostel_warden', 'security_guard', 'it_admin', 'guardian', 'student',
];
const ROLE_GROUPS = ['LEADERS', 'ADMINS', 'ACADEMIC', 'TEACHERS', 'FINANCE', 'ACCOUNTS', 'HR', 'FRONT', 'FAMILY', 'ALL_STAFF', 'PLATFORM'];
const ACCESS_WORDS = ['signed-in', 'public', 'platform', 'webhook'];
const SCOPES = ['global', 'platform', 'org', 'branch'];
const CAPABILITIES = ['hr', 'payroll', 'health', 'counselling', 'papers'];
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const SECTIONS = [
  'Purpose', 'Depends on', 'Tables', 'Contracts', 'Rules', 'Permissions', 'Routes', 'Client layer',
  'Screens', 'Notifications and jobs', 'Offline', 'AI', 'Failure cases', 'Seed data', 'Tests',
];

const errors = [];
const warnings = [];
const err = (file, msg) => errors.push(`${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`${file}: ${msg}`);

const cells = (line) => line.split('|').slice(1, -1).map((c) => c.trim());
const isRow = (line) => line.startsWith('|') && line.trimEnd().endsWith('|');
const isDivider = (line) => /^\|[\s:|-]+\|$/.test(line.trim());
const unTick = (s) => s.replace(/^`|`$/g, '');

// ---------------------------------------------------------------- read modules

const moduleFiles = readdirSync(modulesDir).filter((f) => /^m\d\d-.*\.md$/.test(f)).sort();
const tables = new Map();       // name → { module, file, scope, mods, columns: [{ name, type, rules }] }
const permissions = new Map();  // key → { module, file, allows, roles }
const routes = [];              // { module, file, method, path, permission, does }
const ids = new Map();          // 'R-fees-1' → file
const events = [];              // { module, file, key }
const jobs = [];                // { module, file, key, when }
const settings = [];            // { module, file, key }
const moduleTitles = new Map(); // file → title

for (const file of moduleFiles) {
  const text = readFileSync(join(modulesDir, file), 'utf8');
  const lines = text.split(/\r?\n/);
  const moduleId = file.slice(0, 3).toUpperCase();
  moduleTitles.set(file, (lines[0] || '').replace(/^# /, ''));

  // the fifteen sections, in order
  const found = lines.filter((l) => /^## \d+ · /.test(l)).map((l) => l.replace(/^## \d+ · /, '').trim());
  SECTIONS.forEach((name, i) => {
    if (found[i] !== name) err(file, `section ${i + 1} should be "${name}" but is "${found[i] ?? 'missing'}"`);
  });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // ---- table heading
    const th = line.match(/^#### `([a-z_0-9]+)` · (.+)$/);
    if (th) {
      const [, name, scopeText] = th;
      const parts = scopeText.trim().split(/\s+/);
      const scope = parts[0];
      const mods = parts.slice(1);
      if (!SCOPES.includes(scope)) err(file, `table ${name}: unknown scope "${scope}"`);
      for (const m of mods) {
        if (!/^(\+family(\([a-z_]+\))?|\+self(\([a-z_]+\))?|\+household(\([a-z_]+\))?|\+cap\([a-z]+\)|append-only)$/.test(m)) {
          err(file, `table ${name}: unknown scope modifier "${m}"`);
        }
        const cap = m.match(/^\+cap\(([a-z]+)\)$/);
        if (cap && !CAPABILITIES.includes(cap[1])) err(file, `table ${name}: unknown capability "${cap[1]}"`);
      }
      if (tables.has(name)) err(file, `table ${name} is already defined in ${tables.get(name).file}`);
      // find its column table
      let j = i + 1;
      while (j < lines.length && !isRow(lines[j]) && !/^#{2,4} /.test(lines[j])) j++;
      const columns = [];
      if (j < lines.length && isRow(lines[j]) && /^\|\s*Column\s*\|\s*Type\s*\|\s*Rules\s*\|/.test(lines[j])) {
        j += 2;
        while (j < lines.length && isRow(lines[j])) {
          const c = cells(lines[j]);
          columns.push({ name: c[0], type: c[1] ?? '', rules: c.slice(2).join(' | ') });
          j++;
        }
      } else {
        err(file, `table ${name}: no "| Column | Type | Rules |" table follows the heading`);
      }
      tables.set(name, { module: moduleId, file, scope, mods, columns });
      continue;
    }

    // ---- permission table
    if (/^\|\s*Permission\s*\|\s*Allows\s*\|\s*Default roles\s*\|/.test(line)) {
      let j = i + 2;
      while (j < lines.length && isRow(lines[j])) {
        const c = cells(lines[j]);
        const key = unTick(c[0]);
        if (!/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/.test(key)) err(file, `permission "${c[0]}" is not in the form resource:action`);
        if (permissions.has(key)) err(file, `permission ${key} is already defined in ${permissions.get(key).file}`);
        const roleTokens = (c[2] ?? '').split(',').map((t) => t.trim()).filter(Boolean);
        if (roleTokens.length === 0) err(file, `permission ${key} has no default roles`);
        for (const t of roleTokens) {
          if (!ROLE_GROUPS.includes(t) && !ROLE_KEYS.includes(t)) err(file, `permission ${key}: unknown role or group "${t}"`);
          if (t === 'owner') warn(file, `permission ${key}: "owner" need not be listed; the owner holds everything`);
        }
        permissions.set(key, { module: moduleId, file, allows: c[1] ?? '', roles: roleTokens });
        j++;
      }
      continue;
    }

    // ---- route table
    if (/^\|\s*Method\s*\|\s*Path\s*\|\s*Permission\s*\|\s*Does\s*\|/.test(line)) {
      let j = i + 2;
      while (j < lines.length && isRow(lines[j])) {
        const c = cells(lines[j]);
        const method = c[0];
        const path = unTick(c[1] ?? '');
        const permission = unTick(c[2] ?? '');
        if (!METHODS.includes(method)) err(file, `route ${path}: unknown method "${method}"`);
        if (!path.startsWith('/')) err(file, `route "${path}" does not start with /`);
        routes.push({ module: moduleId, file, method, path, permission, does: c[3] ?? '' });
        j++;
      }
      continue;
    }

    // ---- rule, failure and test ids
    const idm = line.match(/^- \*\*([RFT]-[a-z]+-\d+[a-z]?)\*\*/);
    if (idm) {
      if (ids.has(idm[1])) err(file, `id ${idm[1]} is used twice (also in ${ids.get(idm[1])})`);
      ids.set(idm[1], file);
    }

    // ---- events, jobs, settings
    if (/^Events( of its own)?:/.test(line)) {
      const withNote = /`([a-z][a-z0-9-]*\.[a-z][a-z0-9-]*)`(?:\s*\(((?:[^()]|\([^()]*\))*)\))?/g;
      for (const m of line.matchAll(withNote)) {
        events.push({ module: moduleId, file, key: m[1], note: (m[2] ?? '').replace(/\|/g, '/') });
      }
    }
    if (/^Jobs:/.test(line)) {
      for (const m of line.matchAll(/`([a-z][a-z0-9-]*\.[a-z][a-z0-9-]*)`(\s*\(([^)]*)\))?/g)) {
        jobs.push({ module: moduleId, file, key: m[1], when: m[3] ?? '' });
      }
    }
    if (/^(Other settings|Settings):/.test(line)) {
      for (const m of line.matchAll(/`([a-z_]+\.[a-z_0-9.]+)`/g)) settings.push({ module: moduleId, file, key: m[1] });
    }
  }
}

// ---------------------------------------------------------------- cross checks

for (const [name, t] of tables) {
  const colNames = new Set(t.columns.map((c) => c.name));
  for (const c of t.columns) {
    const fk = c.type.match(/^uuid(?:\[\])? → ([a-z_0-9]+)$/);
    if (fk && !tables.has(fk[1])) err(t.file, `table ${name}.${c.name} points to "${fk[1]}", which no module defines`);
    if (/→/.test(c.type) && !fk) err(t.file, `table ${name}.${c.name}: cannot read type "${c.type}"`);
  }
  for (const m of t.mods) {
    const fam = m.match(/^\+family(?:\(([a-z_]+)\))?$/);
    if (fam) {
      const col = fam[1] ?? 'student_id';
      if (col !== 'id' && !colNames.has(col)) err(t.file, `table ${name} is +family but has no "${col}" column`);
    }
    const self = m.match(/^\+self(?:\(([a-z_]+)\))?$/);
    if (self) {
      const col = self[1] ?? 'user_id';
      if (col !== 'id' && !colNames.has(col)) err(t.file, `table ${name} is +self but has no "${col}" column`);
    }
    const house = m.match(/^\+household(?:\(([a-z_]+)\))?$/);
    if (house) {
      const col = house[1] ?? 'family_id';
      if (col !== 'id' && !colNames.has(col)) err(t.file, `table ${name} is +household but has no "${col}" column`);
    }
  }
  if (new Set(t.columns.map((c) => c.name)).size !== t.columns.length) err(t.file, `table ${name} has a repeated column name`);
}

const routeKeys = new Map();
for (const r of routes) {
  const key = `${r.method} ${r.path}`;
  if (routeKeys.has(key)) err(r.file, `route ${key} is already defined in ${routeKeys.get(key)}`);
  routeKeys.set(key, r.file);
  if (!ACCESS_WORDS.includes(r.permission) && !permissions.has(r.permission)) {
    err(r.file, `route ${key} uses permission "${r.permission}", which no module defines`);
  }
}

const usedPermissions = new Set(routes.map((r) => r.permission));
for (const [key, p] of permissions) {
  if (!usedPermissions.has(key)) warn(p.file, `permission ${key} is not used by any route (it may guard an approval or a field)`);
}

const eventKeys = new Map();
for (const e of events) {
  if (eventKeys.has(e.key) && eventKeys.get(e.key) !== e.file) warn(e.file, `event ${e.key} is also listed in ${eventKeys.get(e.key)}`);
  eventKeys.set(e.key, e.file);
}
const jobKeys = new Map();
for (const j of jobs) {
  if (jobKeys.has(j.key) && jobKeys.get(j.key) !== j.file) warn(j.file, `job ${j.key} is also listed in ${jobKeys.get(j.key)}`);
  jobKeys.set(j.key, j.file);
}

// ---------------------------------------------------------------- generated indexes

const note = '> Generated by `docs/plan/_tools/check.mjs` from the module specifications. Do not edit by hand; edit the module spec and run `pnpm plan:check`.\n';
const link = (file) => `[${file.slice(0, 3).toUpperCase()}](../10-modules/${file})`;
// Text copied out of a module spec keeps its links working from 30-reference/.
const relink = (text) => text
  .replace(/\]\((m\d\d-[a-z0-9-]+\.md)/g, '](../10-modules/$1')
  .replace(/\|/g, '/');

if (writeIndexes) {
  if (!existsSync(refDir)) mkdirSync(refDir, { recursive: true });

  // tables
  {
    const rows = [...tables.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let out = `# Tables index\n\n${note}\n${rows.length} tables in ${moduleFiles.length} modules.\n\n| Table | Module | Scope | Columns |\n|---|---|---|---|\n`;
    for (const [name, t] of rows) out += `| \`${name}\` | ${link(t.file)} | ${[t.scope, ...t.mods].join(' ')} | ${t.columns.length} |\n`;
    out += `\n## By module\n\n| Module | Tables |\n|---|---|\n`;
    for (const file of moduleFiles) {
      const mine = rows.filter(([, t]) => t.file === file).map(([n]) => `\`${n}\``);
      out += `| ${link(file)} ${moduleTitles.get(file).replace(/^M\d\d · /, '')} | ${mine.length ? mine.join(', ') : '—'} |\n`;
    }
    writeFileSync(join(refDir, 'tables-index.md'), out);
  }

  // routes
  {
    const rows = [...routes].sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
    let out = `# Routes index\n\n${note}\n${rows.length} routes under \`/api/v1\`.\n\n| Method | Path | Permission | Module | Does |\n|---|---|---|---|---|\n`;
    for (const r of rows) out += `| ${r.method} | \`${r.path}\` | \`${r.permission}\` | ${link(r.file)} | ${r.does} |\n`;
    writeFileSync(join(refDir, 'routes-index.md'), out);
  }

  // permissions
  {
    const rows = [...permissions.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    let out = `# Permissions index\n\n${note}\n${rows.length} permissions.\n\n| Permission | Module | Allows | Default roles |\n|---|---|---|---|\n`;
    for (const [key, p] of rows) out += `| \`${key}\` | ${link(p.file)} | ${p.allows} | ${p.roles.join(', ')} |\n`;

    const groups = {
      LEADERS: ['director', 'principal', 'vice_principal', 'branch_admin'],
      ADMINS: ['principal', 'branch_admin'],
      ACADEMIC: ['academic_head', 'section_head', 'coordinator', 'exam_controller'],
      TEACHERS: ['class_teacher', 'subject_teacher'],
      FINANCE: ['finance_head', 'accountant', 'cashier'],
      ACCOUNTS: ['finance_head', 'accountant'],
      HR: ['hr_manager', 'payroll_officer'],
      FRONT: ['admissions_officer', 'receptionist'],
      FAMILY: ['guardian', 'student'],
      PLATFORM: ['super_admin', 'support_agent'],
    };
    const staffRoles = ROLE_KEYS.filter((r) => !['guardian', 'student', 'super_admin', 'support_agent'].includes(r));
    groups.ALL_STAFF = staffRoles;
    const byRole = new Map(ROLE_KEYS.map((r) => [r, []]));
    for (const [key, p] of rows) {
      const holders = new Set();
      for (const t of p.roles) (groups[t] ?? [t]).forEach((r) => holders.add(r));
      for (const r of holders) byRole.get(r)?.push(key);
    }
    out += `\n## By role\n\nThe owner holds every permission. The auditor holds every permission whose action is \`read\`, \`reports\` or \`export\`, except health and counselling. Both are omitted below except where a spec names them.\n\n| Role | Count | Permissions |\n|---|---|---|\n`;
    for (const r of ROLE_KEYS) {
      const list = byRole.get(r);
      if (!list.length) continue;
      out += `| \`${r}\` | ${list.length} | ${list.map((k) => `\`${k}\``).join(', ')} |\n`;
    }
    writeFileSync(join(refDir, 'permissions-index.md'), out);
  }

  // events
  {
    const rows = [...events].sort((a, b) => a.key.localeCompare(b.key));
    let out = `# Events index\n\n${note}\n${new Set(rows.map((r) => r.key)).size} events. The rules for audiences, channels and wording are in the [notification catalogue](notification-catalogue.md). The note beside each event is what its module spec says about who is told and when.\n\n| Event | Module | Note from the spec |\n|---|---|---|\n`;
    const seen = new Set();
    for (const e of rows) { if (seen.has(e.key)) continue; seen.add(e.key); out += `| \`${e.key}\` | ${link(e.file)} | ${relink(e.note || '')} |\n`; }
    writeFileSync(join(refDir, 'events-index.md'), out);
  }

  // jobs
  {
    const rows = [...jobs].sort((a, b) => a.key.localeCompare(b.key));
    let out = `# Jobs index\n\n${note}\n${new Set(rows.map((r) => r.key)).size} background jobs. Times are Pakistan time.\n\n| Job | Module | When |\n|---|---|---|\n`;
    const seen = new Set();
    for (const j of rows) { if (seen.has(j.key)) continue; seen.add(j.key); out += `| \`${j.key}\` | ${link(j.file)} | ${relink(j.when || 'queued when needed')} |\n`; }
    writeFileSync(join(refDir, 'jobs-index.md'), out);
  }

  // settings
  {
    const rows = [...settings].sort((a, b) => a.key.localeCompare(b.key));
    let out = `# Settings index\n\n${note}\n${new Set(rows.map((r) => r.key)).size} settings named in module specifications. Defaults and meaning are in each module's section 4.\n\n| Setting | Module |\n|---|---|\n`;
    const seen = new Set();
    for (const s of rows) { if (seen.has(s.key)) continue; seen.add(s.key); out += `| \`${s.key}\` | ${link(s.file)} |\n`; }
    writeFileSync(join(refDir, 'settings-index.md'), out);
  }
}

// ---------------------------------------------------------------- links and id references, across the whole plan (after the indexes are rebuilt, so they are checked fresh)

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

const allDocs = walk(planDir);
for (const full of allDocs) {
  const rel = relative(planDir, full).replace(/\\/g, '/');
  const text = readFileSync(full, 'utf8');
  // a permission key mentioned in prose must exist
  if (!/^30-reference\/[a-z]+-index\.md$/.test(rel) && !rel.startsWith('_tools/')) {
    for (const m of text.matchAll(/`([a-z][a-z0-9-]*:[a-z][a-z0-9-]*)`/g)) {
      if (/^(db|plan|test|api|client|ui|i18n|resource):/.test(m[1]) || m[1] === 'ai:eval') continue;   // pnpm scripts and the format example
      if (!permissions.has(m[1])) warn(rel, `mentions permission ${m[1]}, which no module defines`);
    }
  }
  for (const m of text.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    const label = m[1];
    const target = m[2];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const [pathPart] = target.split('#');
    const dest = resolve(dirname(full), pathPart);
    if (!existsSync(dest)) err(rel, `link to "${target}" does not resolve`);
    const idRef = label.match(/^[RFT]-[a-z]+-\d+[a-z]?$/);
    if (idRef && existsSync(dest)) {
      const destName = dest.replace(/\\/g, '/').split('/').pop();
      if (!ids.has(label)) err(rel, `reference to ${label}, which does not exist`);
      else if (ids.get(label) !== destName) err(rel, `reference to ${label} points at ${destName}, but it is defined in ${ids.get(label)}`);
    }
  }
}

// capabilities named in the access document must be real permissions
const accessDoc = join(planDir, '00-foundation', '06-tenancy-roles-and-access.md');
if (existsSync(accessDoc)) {
  const text = readFileSync(accessDoc, 'utf8');
  const block = text.split('### Capabilities for sensitive tables')[1]?.split('The list lives in')[0] ?? '';
  for (const m of block.matchAll(/`([a-z][a-z0-9-]*:[a-z][a-z0-9-]*)`/g)) {
    if (!permissions.has(m[1])) err('00-foundation/06-tenancy-roles-and-access.md', `capability refers to permission ${m[1]}, which no module defines`);
  }
}

// ---------------------------------------------------------------- machine-readable copy of the plan
// `--json` writes docs/plan/_tools/out/plan.json. The repository's own scripts compare it with the
// real schema (`pnpm db:verify-plan`) and the real route manifest (`pnpm api:verify-plan`).

if (process.argv.includes('--json')) {
  const outDir = join(here, 'out');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const plan = {
    tables: [...tables.entries()].map(([name, t]) => ({
      name, module: t.module, scope: t.scope, modifiers: t.mods,
      columns: t.columns.map((c) => ({ name: c.name, type: c.type })),
    })),
    permissions: [...permissions.entries()].map(([key, p]) => ({ key, module: p.module, roles: p.roles })),
    routes: routes.map((r) => ({ method: r.method, path: r.path, permission: r.permission, module: r.module })),
    events: [...eventKeys.keys()].sort(),
    jobs: [...jobKeys.keys()].sort(),
    settings: [...new Set(settings.map((x) => x.key))].sort(),
    ids: [...ids.keys()].sort(),
  };
  writeFileSync(join(outDir, 'plan.json'), JSON.stringify(plan, null, 2));
}

// ---------------------------------------------------------------- report

const count = (re) => [...ids.keys()].filter((k) => re.test(k)).length;
console.log(`modules      ${moduleFiles.length}`);
console.log(`tables       ${tables.size}`);
console.log(`columns      ${[...tables.values()].reduce((n, t) => n + t.columns.length, 0)}`);
console.log(`permissions  ${permissions.size}`);
console.log(`routes       ${routes.length}`);
console.log(`rules        ${count(/^R-/)}`);
console.log(`failures     ${count(/^F-/)}`);
console.log(`tests        ${count(/^T-/)}`);
console.log(`events       ${eventKeys.size}`);
console.log(`jobs         ${jobKeys.size}`);
console.log(`settings     ${new Set(settings.map((s) => s.key)).size}`);
console.log(`documents    ${allDocs.length}`);
if (warnings.length && process.argv.includes('--warnings')) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  ${w}`);
} else if (warnings.length) {
  console.log(`\n${warnings.length} warning(s). Run with --warnings to list them.`);
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}
console.log('\nNo errors.');
