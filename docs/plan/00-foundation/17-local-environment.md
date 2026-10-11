# 17 · Local environment

Everything runs on one machine with Docker until [Phase 21](../20-phases/phase-21-hardening-and-launch.md). No cloud account is needed before then.

## What must be installed

| Tool | Version | Check |
|---|---|---|
| Node.js | 22 LTS | `node -v` |
| pnpm | 10 | `pnpm -v` |
| Docker Desktop | current, running | `docker --version` |
| Supabase CLI | 2.109 or newer | `supabase --version` |
| Git | current | `git --version` |

Found on this machine on 10 Oct 2026: Node 22.17, pnpm 10.34, Docker 29.6, Supabase CLI 2.109.1, Git 2.50.

Windows notes:

- Keep the repository at a short path (`C:\Users\<you>\Desktop\projects\takhti`).
- Run once: `git config --global core.longpaths true`.
- Docker Desktop must be started before `pnpm db:start`.

## First-time setup

```bash
pnpm install
```

```bash
pnpm db:start
```

```bash
pnpm db:env
```

```bash
pnpm db:reset
```

```bash
pnpm dev
```

`pnpm db:env` writes `.env.local` at the repository root from the running local stack: the keys, the two database addresses, and the two values that have no other source (the API role's database password and the encryption key), which it generates once. It prints nothing secret and keeps values already in the file. `pnpm db:reset` empties the database, applies every migration, lets the API role sign in, and loads the seed data, then prints the seeded sign-in accounts.

With the app running, `pnpm smoke` signs in as several seeded accounts and calls the API: the quickest proof that everything is wired.

## Local services and ports

| Service | Address |
|---|---|
| Web app and API | http://localhost:3000 |
| Supabase API (Auth, Storage, Realtime) | http://localhost:64321 |
| Postgres | `localhost:64322`, database `postgres` |
| Supabase Studio | http://localhost:64323 |
| Mail catcher (all emails land here) | http://localhost:64324 |
| PowerSync (Phase 17) | http://localhost:8080 |

The ports are in the 6432x block, not Supabase's usual 5432x, so this stack can run beside other Supabase projects on the same machine.

## `supabase/config.toml` — settings that matter

| Setting | Value | Why |
|---|---|---|
| `api.enabled` | `false` | Supabase's own Data API is off: Takhti's API is the only way to data ([06](06-tenancy-roles-and-access.md), "One door"). Auth, Storage and Realtime are not affected |
| `db.migrations.enabled`, `db.seed.enabled` | `false` | Migrations and seed data are applied by `pnpm db:migrate` and `pnpm db:seed`, not by the CLI |
| `auth.site_url` | `http://localhost:3000` | Links in emails |
| `auth.enable_signup` | `false` | Nobody signs themselves up; users are invited |
| `auth.jwt_expiry` | `3600` | One-hour access tokens |
| `auth.email.enable_confirmations` | `true` | Emails go to the mail catcher |
| `auth.email.enable_signup`, `auth.sms.enable_signup` | `true` | Despite the name these switch the whole method on or off, sign-in included. New sign-ups are blocked by `auth.enable_signup = false` |
| An SMS provider block | present, with placeholder values | Without a provider block the local Auth server silently disables phone sign-in |
| `auth.sms.test_otp` | The seeded guardians' numbers mapped to a fixed code | Phone sign-in works locally with no SMS |
| `auth.hook.custom_access_token` | `pg-functions://postgres/public/custom_access_token_hook` | Adds organisation claims to the token |
| `auth.mfa.totp` | enrol and verify enabled | Two-factor for staff |
| `storage.file_size_limit` | `100MiB` | Matches the largest allowed upload |
| `db.major_version` | `17` | |

Known behaviour to remember: Supabase Auth stores a phone number without the leading `+`. Code that looks up a user by phone must compare without it.

## Environment variables

`.env.example` lists every variable. The app refuses to start if one is missing or malformed (`kernel/env.ts`).

| Variable | Used by | Local value |
|---|---|---|
| `APP_URL` | web | `http://localhost:3000` |
| `NEXT_PUBLIC_SUPABASE_URL` | web, browser | `http://127.0.0.1:64321` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | web, browser | from `pnpm db:start` |
| `SUPABASE_SECRET_KEY` | server, worker | from `pnpm db:start`. Never in client code |
| `DATABASE_URL` | server, worker | `postgres://takhti_api:<password>@127.0.0.1:64322/postgres` |
| `DATABASE_ADMIN_URL` | migrations, seed, worker, platform services | `postgres://postgres:<password>@127.0.0.1:64322/postgres` |
| `TAKHTI_API_DB_PASSWORD` | `db:reset` | any local value |
| `ENCRYPTION_KEY` | server, worker | 32 random bytes, base64 |
| `SMS_PROVIDER`, `WHATSAPP_PROVIDER`, `EMAIL_PROVIDER`, `PUSH_PROVIDER` | worker | `log` |
| `PAYMENT_PROVIDER` | server | `fake` |
| `AI_PROVIDER` | server, worker | `fake` (use `anthropic` with `ANTHROPIC_API_KEY` to try real answers) |
| `LOG_LEVEL` | all | `debug` |
| `TEST_DB` | tests | `pglite` (default) or `postgres` |

## Seeded data

`pnpm db:seed` creates one demo school group, "Roshan Public School", with two branches, a full academic year, staff, students with guardians, fee vouchers in every state, exams with marks, and one sign-in account for every built-in role; plus a very small second organisation that exists so isolation tests have another tenant to try to reach. Details are in [seed data](../30-reference/seed-data.md).

The accounts and their passwords are defined in `packages/db/src/seed/accounts.ts` and printed at the end of the seed run. They exist only in the local database.

## Daily work

| Task | Command |
|---|---|
| Start the day | `pnpm db:start`, then `pnpm dev`, and `pnpm worker` in a second terminal |
| Run the checks | `pnpm check` |
| Watch tests for one module | `pnpm test tests/api/fees --watch` |
| Fresh database | `pnpm db:reset` |
| Look at data | `pnpm db:studio` |
| Read sent emails | open http://localhost:64324 |
| Read sent SMS and WhatsApp | the developer outbox at `/dev/outbox` |
| End the day | `pnpm db:stop` |

## Changing the database

1. Edit or add a `*.table.ts` file.
2. `pnpm db:generate --name <what-changed>` creates a migration folder.
3. Read the generated SQL. Check that it does what was intended and nothing else.
4. `pnpm db:migrate`.
5. Update the contract, db-service and tests.
6. `pnpm check`.

SQL that Drizzle cannot express (functions, triggers, grants, extensions) goes in a custom migration: `pnpm db:generate --custom --name <name>`.

A merged migration is never edited. During Phases 0 to 3, before any real data exists, the schema may still be squashed once at the end of Phase 1; the phase file says exactly when.

## Backup and restore (local)

```bash
pnpm db:backup
```

```bash
pnpm db:restore backups/<file>.sql
```

## When something goes wrong

| Symptom | Cause and fix |
|---|---|
| `pnpm db:start` hangs or fails | Docker Desktop is not running, or ports 64320–64324 are in use. Start Docker; `supabase stop --no-backup` then start again |
| Sign-in fails for every seeded account | The access-token hook is missing because migrations were not applied. Run `pnpm db:reset` |
| "Migration … was edited after it was applied" | A migration file changed after it ran. On a local database, `pnpm db:reset`; anywhere else, restore the file and add a new migration |
| "permission denied for table …" in the app | A query ran outside `withUserTx`, or grants were not applied. Run `pnpm db:reset`; check the code path uses `runAs` |
| "new row violates row-level security policy" | The service wrote a row for another organisation or branch. This is the second wall doing its job; fix the service |
| Phone sign-in does nothing locally | The SMS provider block or the test OTP map is missing from `config.toml` |
| A Node tool fails with `ERR_PACKAGE_IMPORT_NOT_DEFINED` | The repository path is too long. Move it to a short path |
| Types are out of date after pulling | `pnpm install`, then restart the TypeScript server |
| Tests pass on PGlite but fail on Postgres | Run `pnpm test:db` and read the difference; usually an extension or a role that PGlite lacks |
| The worker does nothing | It is not running, or `DATABASE_ADMIN_URL` is wrong |
