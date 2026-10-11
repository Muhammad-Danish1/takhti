# Lessons learned

Things that cost real time once while building Takhti. Each is here so that it costs nobody time twice. Add to it whenever something behaves differently from what the documentation, or memory, suggested.

## Drizzle 1.0 (release candidate)

- There is no `casing` option on the connection. Tables are declared with the project's `table()` helper, which wraps `snakeCase.table`.
- Inside a table's extra-config callback, a column's allowed values are at `column.config.enumValues`.
- An array column reports its base type from `getSQLType()` and its depth from `dimensions`.
- `sql.identifier()` returns a `Name`, not `SQL`: wrap it in a `sql` template when a list of `SQL` is needed.
- `drizzle-kit generate --custom --name x` makes an empty migration to write by hand.
- **`drizzle-kit generate` can wait for a keyboard for ever** when run from a script. Close its input: `drizzle-kit generate … < /dev/null`.
- **Migrations chain through their snapshots.** To regenerate a migration that is not the newest, delete it and every later one, then generate them again in order. `pnpm db:custom-sql N` only appends to the newest migration.
- **A generated column cannot name its siblings through `t`**, because columns are declared outside the callback that has `t`. It names them through the table, inside a function: `generatedAlwaysAs((): SQL => sql\`${feeVouchers.total} - ${feeVouchers.paid}\`)`. The table generator writes this.
- Over a generic table, use `InferSelectModel<T>` and `InferInsertModel<T>`; `T['$inferSelect']` does not resolve.

## Table files

- **A table file must not be used while it is still loading.** Two files may refer to each other only because every reference is lazy, `(): AnyPgColumn => other.id`, and because `orgIdColumn` and `branchIdColumn` come from `kernel/base-columns.ts`. A file loaded in the middle of a cycle once saw `baseColumns` as undefined and quietly made tables without `org_id`. `registerTable` now refuses a table that lacks the columns its scope needs.
- A table nobody reaches through the application role (`staff: 'none'` and no other audience) still gets a policy, one that allows nothing, or row-level security would be off. `defineTable` adds it.
- A table that keeps one row for each organisation has a unique index on `org_id` alone. The security tests detect that and probe it in two places instead of three.

## Postgres and row-level security

- An `INSERT … RETURNING`, or one with `ON CONFLICT (columns)`, makes Postgres apply the table's read policy to the new row. A row a family user may add but not read (an audit entry, an event, a job) is inserted without `returning` and with a bare `on conflict do nothing`.
- The `WITH CHECK` of a policy runs before constraints, so error `42501` on its own means "row-level security refused".
- **A view runs with its owner's rights, and default privileges make it writable.** Every view revokes all, grants `select`, filters by `app.org_id()` itself, is listed in `tests/db/foundation.test.ts` and proved in `tests/api/security/views.test.ts`.
- **A new function in the `app` schema needs an explicit grant** (`grant execute on function … to authenticated, service_role`): the foundation revokes the default. A function that a trigger calls as the invoking user needs it too.
- An index expression must be immutable, and joining a list of words is not: the library's search index goes through `app.words(text[])`.
- `transaction_timeout` ends the connection, and the driver then throws from a timer where nothing can catch it. Use `statement_timeout`, which gives a clean error `57014`, plus a timer in JavaScript.

## The real Postgres against the in-process one

- The in-process database (PGlite) is one session with no timers. Server-side timeouts never fire, a privileged query issued while a transaction is open deadlocks, and concurrency tests pass trivially. **`pnpm test:db` is a real gate.**
- PGlite loses stack with every refused statement. The generated security tests therefore probe tables in batches of 25, each on a fresh database, and release their savepoints as well as rolling them back.
- PGlite 0.5.8 has no pgvector. `knowledge_chunks.embedding` is a plain list of numbers until vector search is switched on.
- **On the real server a refused statement fails its transaction at the end, even when the error was caught** and rolled back to a savepoint. That is how the `postgres` driver's `begin` works. A test that probes with statements it expects to be refused ends its transaction by throwing an error of its own (`probeTable` and `sandbox` do this with `Undo`).
- `session_replication_role = replica` (foreign keys and triggers off) works on both engines; the tests use it to let a row stand without its parents.

## Supabase, locally

- `auth.email.enable_signup = false` switches the sign-in method off altogether, not only sign-up. Block sign-ups with `auth.enable_signup = false`.
- The Data API (PostgREST and GraphQL) is switched off in `supabase/config.toml` on purpose.
- `postgres` may `grant authenticated to takhti_api` but cannot `SET ROLE` to a role it created, so the tests sign in as `takhti_api` directly.
- Migrations are applied by the project's own runner, never by the CLI. `pnpm db:reset` uses `supabase db reset --no-seed` only to empty the database.
- Takhti's stack uses ports 64320 to 64324. Other projects' stacks on this machine use the usual ports and must be left running.

## Zod 4, TypeScript 7, the linter, Prettier

- Zod applies `.default()` inside optional and partial objects, so an update body is built from fields without defaults. A schema's parsed output is not always valid input for the same schema.
- TypeScript 7 has no classic JavaScript API, so the linter carries TypeScript 6 as its parser. With `exactOptionalPropertyTypes` a patch type must allow `| undefined` explicitly.
- Call `./node_modules/.bin/tsc` directly; `npx tsc` tries the network.
- Prettier sometimes needs two passes on long lines (the generators run it up to three times), and it moves a `@ts-expect-error` away from the line it guards when it wraps a call: put the directive inside the object, on the property.
- Turborepo writes an `AGENTS.md` into the repository when it detects an assistant; `"agentGuidance": false` in `turbo.json` stops it.

## The generators

- `pnpm scaffold` fails on purpose for: a `Policy:` line with no decision in the hints; a hint that changes access with no `Policy:` line in the spec; a column rule that reads like a constraint with nothing accounting for it; a unique rule over an optional column with no `nulls: 'same' | 'distinct'`; any line under a table it cannot read. Fix the hint or the spec. Never delete the sentence.
- Hint shortcuts: on a column, `neededWhen: { other_column: 'value' | ['a', 'b'] | true }` becomes a "required when" check and gives the security tests a row that asks for nothing; on a table, `sample: { camelKey: 'code' }` gives single values to that row.
- A hand-written `fixture` in the hints replaces the generated one entirely: include the date pairs a "from before to" check needs.
- Money that may be negative (a cash difference, an overdrawn balance, a reversal, stock going out) says `signed: true`, or the table gets a "not below zero" check.
- Once a wave adds the tables of people, earlier rows that pointed at ids yet to come become foreign keys: test helpers and the seed create the real rows first.
- `pnpm scaffold:api` loads the table files, which load the contracts, which include every contract it wrote before. If a generated contract no longer loads, it empties `packages/contracts/src/modules/generated-api.ts` and asks to be run again.
- The API generator holds a column back from the client when its rule says it is computed, copied, maintained or numbered. That wording test is cautious: a column the client really does send is listed under `input` in `api-hints.mjs`.

## The seed

- The seed is deterministic and relative to "today"; `--today` pins it. 10 October 2026 is a Saturday, so what happens "today at school" is placed on the last school day.
- A student may have sat in two sections this year (a transfer between campuses, a change of section). `SeededStudent.stays` says where they were on each day; attendance and homework follow it.
- Most teachers have no sign-in in the seed, because there is one account per role. What such a teacher did is recorded under the academic office of their campus (`wave3/shared.ts`, `actorsOf`).
- Approved leave is written into the register as leave, and nothing else is: the two always agree, and a check in `seed/verify.ts` holds them to it.
- `pnpm db:seed --timing` says how long each part took.

## Writing tests

- "Staff of another organisation" do read the row that sits in their own organisation (`foreign`). Hand-written expectations get this wrong easily.
- A route checks its permission before it reads the request. A test of "403 without the permission" may therefore send any body at all.
- A permission that everyone holds, families included (the calendar, the list of subjects), has nobody to refuse.

## Windows, and working through an assistant's shell

- Keep the repository at a short path. Node tools that use package `imports` fail when the real path passes 260 characters.
- **JavaScript's `String.replace(a, b)` with a text `b` expands `$&`, `` $` `` and `$'`.** It once corrupted the table generator. Use `split(a).join(b)` after checking there is exactly one occurrence, or edit the file directly.
- In a heredoc passed to a shell tool, `\\n` and backslash-escaped backticks inside JavaScript strings arrive mangled. For any edit that contains escapes, edit the file directly instead of writing a script.
- `node -e "…"` with backticks inside runs them as shell substitution.
- The network to the npm registry is slow here; `pnpm install --offline` works because the packages are in the local store.
- A server for a smoke test is started as a background command, `node apps/web/node_modules/next/dist/bin/next dev apps/web --port 3000`, and stopped afterwards by its port.
- **When tools crash on start, check memory first.** On 11 October 2026 the machine had reserved its whole virtual memory limit after four days without a restart; the type-checker, `tsx`, Docker and even `fork` failed. `(Get-Counter '\Memory\Committed Bytes','\Memory\Commit Limit')` shows it. Only a restart fixed it.
