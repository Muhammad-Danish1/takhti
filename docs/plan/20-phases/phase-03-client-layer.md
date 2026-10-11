# Phase 3 · API-services and hooks

**Goal.** Every route has a typed function to call it and a React Query hook to use it. A screen written later needs no knowledge of URLs, headers, caching or error shapes; it imports a hook.

**Depends on.** [Phase 2](phase-02-services-and-routes.md).

**Produces.** Layers 6 and 7 for all 45 modules, in `@takhti/api-client` and `@takhti/hooks`. Both packages run in a browser and, unchanged, in the mobile apps of [Phase 23](phase-23-mobile-apps.md).

## Read first

[07 · Backend kernel](../00-foundation/07-backend-kernel.md) (the last two sections), [08 · API standards](../00-foundation/08-api-standards.md), [16 · Frontend architecture](../00-foundation/16-frontend-architecture.md) ("Rules for screens"), and section 8 of each module spec.

## The two layers

### API-services — `packages/api-client/src/modules/<module>/<resource>.api-service.ts`

A plain object of async functions. No React.

```ts
export const feePaymentsApi = {
  ...createApiService(feePaymentsContract),            // list, get, create, update, remove where the routes exist
  collect: (input: CollectPayment) =>
    http.post('/fee-payments', input, { schema: PaymentResult, idempotent: true }),
  reverse: (id: Id, input: ReversePayment) =>
    http.post(`/fee-payments/${id}/reverse`, input, { schema: FeePayment, idempotent: true }),
};
```

Rules:

- Inputs and outputs are the contract's types. In development and tests the response is parsed with the contract's schema, so a backend that drifts from its contract fails loudly; in production the parse is skipped for speed.
- A function marked `idempotent` gets an `Idempotency-Key`. The key is made by the **caller** when the user's intent begins (a form opens, a cart is created) and passed in, so a retry of the same intent reuses it.
- Errors are thrown as `ApiError` with `code`, `message`, `fields` and `requestId`. Nothing returns `null` on failure.
- Downloads return a `Blob` with the file name from the response headers.
- No function builds a URL by hand outside this layer.

### Hooks — `packages/hooks/src/modules/<module>/<resource>.hooks.ts`

```ts
export const { useFeePaymentsList, useFeePayment } = createCrudHooks(feePaymentsApi, keys.feePayments);

export function useCollectPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: feePaymentsApi.collect,
    onSuccess: (result) => invalidate(qc, [
      keys.families.dues(result.payment.familyId),
      keys.feeVouchers.lists(),
      keys.cashSessions.current(),
    ]),
  });
}
```

Rules:

- **Query keys** come only from `keys.ts`, a typed factory per resource (`all`, `lists()`, `list(filters)`, `detail(id)`, plus named ones). Nobody writes a key array by hand.
- **Invalidation is declared**, in one place per module: `<module>.invalidation.ts` maps each mutation to the keys it makes stale, including keys of other modules (collecting a fee makes the family's dues, the voucher lists and the cashier's session stale). A test walks every mutation and asserts it has an entry.
- **Optimistic updates** only where the module spec says "optimistic" (marking attendance, ticking a checklist, sending a chat message), always with rollback on error. **Money is never optimistic**: the hooks for payments, sales and payroll wait for the server.
- **Stale times** by kind of data: setup data (grades, fee heads) 5 minutes; lists 30 seconds; a counter screen's dues 0; dashboards per widget.
- **Lists** keep the previous page while the next loads (`placeholderData`), accept the URL's filter object as their argument, and expose `page`, `total` and `isFetching`.
- **Polling** only where a spec asks for it (an intent's status, a job's progress), with a stop condition.
- **Realtime** through one helper, `useRealtimeInvalidate(channel, keys)`: a Supabase Realtime event marks keys stale; the query refetches through the API. Data never comes from the socket itself, so permissions are always the API's.
- **Offline-aware**: mutations for offline-writable resources go through `useOfflineMutation`, which today simply calls the API and in [Phase 17](phase-17-offline.md) writes to the local database instead. Screens will not change.
- A hook never shows a toast and never navigates. It returns state; the screen decides.

### Shared hooks — `packages/hooks/src/kernel/`

| Hook | Purpose |
|---|---|
| `useMe()` | The `GET /me` response: profile, memberships, roles, permissions, branches, modules, locale. Loaded once per session |
| `useCan(permission)`, `useCanAny([...])` | Permission checks on the client, for hiding only |
| `useModule(key)` | Whether a module is switched on |
| `useBranch()` | The current branch from the shell's switcher, and its setter. Sent as `x-branch-id` by the client |
| `useAcademicYear()` | The year the shell is showing |
| `useSetting(key)` | A typed setting |
| `useListParams(schema)` | Page, sort and filters bound to the URL with `nuqs`, typed by the contract's list schema |
| `useOnline()` | Network state, for the offline banner |
| `useIdempotencyKey(scope)` | A key that lives as long as the form or cart it belongs to, and is renewed after success |
| `useJobProgress(jobId)` | Polls a job until it ends |
| `useExport(kind)` | Starts an export, follows it, returns the download |
| `useUpload(purpose)` | The three-step upload with progress, retry and cancel |
| `useDocument(kind, params)` | Requests a document and returns its link when ready |
| `useDebouncedValue`, `useBarcodeInput` | Small helpers reused across modules |

`applyApiError(form, error)` puts a `VALIDATION` error's `fields` under the right inputs and returns the message for the rest.

## Work packages

### 3.1 · Finish the client kernel

- [ ] `http` client: base URL, credentials, `x-branch-id`, `x-request-id` read back for error reports, idempotency keys, one retry for `GET` on a network error, a single "session expired" event, upload and download helpers, `AbortSignal` support.
- [ ] `createApiService`, `createCrudHooks`, `keys.ts` factory, `invalidate`, `query-client.ts` defaults.
- [ ] The shared hooks above, each with tests.
- [ ] Test harness: `renderHookWithClient` and a fake `fetch` that routes requests to the **real Route Handlers** on PGlite, so client tests exercise the true backend with no mock responses.

### 3.2 to 3.10 · Modules, in the wave order of [Phase 1](phase-01-database.md)

For each module:

- [ ] An api-service function for every route of the module (generated CRUD where the routes are plain CRUD; named functions otherwise).
- [ ] Hooks: generated CRUD hooks, plus every custom hook named in the spec's section 8, with the behaviour that section describes.
- [ ] `<module>.invalidation.ts`.
- [ ] Tests: each api-service function called through the fake `fetch` against the real handler (happy path and one error path); each custom hook's stated behaviour (optimistic and rollback, polling stop, key reuse).
- [ ] Type tests: wrong filter, wrong sort, wrong input shape fail to compile.

### 3.11 · Coverage tools

- [ ] `pnpm client:verify`: compares the route manifest with the api-services (every route has exactly one function) and the list of hooks in `plan.json`'s source specs with the exported hooks. Reports anything missing or extra.
- [ ] A bundle check: `@takhti/api-client` and `@takhti/hooks` build for the browser with no Node built-ins and no import of `core` or `db`.

## Exit checks

1. `pnpm client:verify` reports every route covered and every hook named in a spec's section 8 present.
2. Every mutation has an invalidation entry; the test that walks them passes.
3. No hook for a money operation uses an optimistic update (a lint rule on the money modules' hook files).
4. `pnpm check` is green; client tests run against the real handlers.
5. A scratch page in `apps/web/app/dev/hooks` (development only) lists students with `useStudentsList`, filters through the URL, and collects a fee with `useCollectPayment`, with no code beyond hooks and plain HTML. This is the proof that screens will be thin.
6. The two packages import nothing from `core`, `db` or Node.

## Left for later, on purpose

- Any styling or component: [Phase 4](phase-04-frontend-foundation.md).
- The local database behind `useOfflineMutation`: [Phase 17](phase-17-offline.md).
