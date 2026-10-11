# Takhti

School management software for Pakistan, for school groups teaching Grades 1 to 10.

**Where it stands (11 October 2026):** the backend is being built first. All 416 tables exist with their access rules, and the plain list, add, read, change and delete operations exist for 222 kinds of record (567 of 1,615 planned API operations). No business rule of any module is written yet, and there is no screen. **[`docs/STATUS.md`](docs/STATUS.md) is the full handover:** what is built, what was checked, what comes next and what was left out on purpose. The progress table is in [`docs/plan/README.md`](docs/plan/README.md).

## Run it

You need Node.js 22, pnpm 10, Docker Desktop (running) and the Supabase CLI. Details and troubleshooting are in [`docs/plan/00-foundation/17-local-environment.md`](docs/plan/00-foundation/17-local-environment.md).

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

`pnpm db:env` writes `.env.local` from the running local stack. `pnpm db:reset` builds the database and loads the demonstration school, then prints the sign-in accounts. The app is then at http://localhost:3000. In a second terminal, `pnpm worker` runs background jobs, and `pnpm smoke` checks the whole stack with real sign-ins.

## Check it

| Command               | Does                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------- |
| `pnpm check`          | Type-check, lint and every test on an in-process database. The gate before every commit |
| `pnpm test:db`        | The same tests on the Docker Postgres                                                   |
| `pnpm db:verify-plan` | Compares the tables in code with the plan                                               |
| `pnpm plan:check`     | Checks the plan's own cross-references                                                  |

## Find your way

- [`docs/STATUS.md`](docs/STATUS.md) — where the build stands and what to do next. Read this first.
- [`docs/plan/README.md`](docs/plan/README.md) — the plan: the index, the 24 phases and the progress table.
- [`docs/reference/lessons-learned.md`](docs/reference/lessons-learned.md) — traps already fallen into.
- [`docs/reference/adding-a-resource.md`](docs/reference/adding-a-resource.md) — the eight steps every resource takes through the layers.
- [`docs/design/theme/kashi-theme.html`](docs/design/theme/kashi-theme.html) — the approved look.
- [`CLAUDE.md`](CLAUDE.md) — the rules for anyone, or any AI assistant, working in this repository.
