# 08 · API standards

One HTTP API serves the web app, the mobile apps, the offline upload and outside integrations. Every route follows these rules, and the route builder in the kernel enforces most of them.

## Shape

- Base path: `/api/v1`. JSON in, JSON out, UTF-8.
- Resource names are kebab-case plural nouns: `/fee-vouchers`.
- An action that is not plain create, read, update or delete is a `POST` to a verb under the record: `/fee-vouchers/[id]/collect`.
- Nesting is at most one level, and only when the child cannot exist alone: `/exams/[id]/papers`.
- Field names in JSON are camelCase.

| Method | Path | Meaning | Success |
|---|---|---|---|
| `GET` | `/things` | List, with filters and paging | `200` |
| `POST` | `/things` | Create | `201` |
| `GET` | `/things/[id]` | Read one | `200` |
| `PATCH` | `/things/[id]` | Change some fields; body carries `version` | `200` |
| `DELETE` | `/things/[id]` | Soft delete | `204` |
| `POST` | `/things/[id]/restore` | Undo a delete | `200` |
| `POST` | `/things/[id]/<verb>` | A named action | `200` |
| `POST` | `/things/bulk` | Many creates or actions in one call | `200` with per-item results |

A partial update is always `PATCH`. `PUT` is used only where the request replaces a whole value that has no version of its own: one setting, or "save this whole set" (a role's permissions, a section's subject teachers).

## Responses

Success:

```json
{ "data": { "id": "…", "version": 4, "…": "…" } }
```

List:

```json
{ "data": { "items": [ … ], "page": 1, "pageSize": 25, "total": 1248 } }
```

Failure, always this shape:

```json
{
  "error": {
    "code": "VALIDATION",
    "message": "Some fields need attention",
    "fields": { "bFormNo": ["Use the format 12345-1234567-1"] },
    "requestId": "c1b2…"
  }
}
```

## Error codes

| Code | HTTP | When | What the screen does |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | No session, or it expired | Sends the user to sign in, then back to the same page |
| `FORBIDDEN` | 403 | Missing permission, wrong branch, module off | Shows a "you do not have access" state |
| `NOT_FOUND` | 404 | No such record, or not visible to this user | Shows a "not found" state |
| `VALIDATION` | 422 | Input is wrong | Puts each message under its field |
| `CONFLICT` | 409 | Duplicate value, or the record is in use | Shows the message beside the field or as a toast |
| `STALE` | 409 | Someone else saved first | Offers "Reload" and keeps the user's typed values |
| `RULE` | 409 | A business rule said no | Shows the message as written |
| `RATE_LIMITED` | 429 | Too many requests | Shows "try again in N seconds" |
| `INTERNAL` | 500 | A bug | Shows a calm message with the request id |

The client decides by `code`, never by message text. Messages are written for people and may be translated.

## Lists

Every list endpoint accepts the same query string:

| Param | Meaning | Default |
|---|---|---|
| `page` | Page number from 1 | 1 |
| `pageSize` | 1 to 100 (200 for exports) | 25 |
| `q` | Free-text search over the module's search columns | — |
| `sort` | One of the module's sortable names | Per module |
| `order` | `asc` or `desc` | `asc` |
| *filters* | Flat keys defined by the module: `status=overdue&gradeId=…` | — |

- A filter that takes several values uses commas: `status=unpaid,partial`.
- Date ranges use `from` and `to`, both inclusive.
- Unknown parameters are rejected with `422`, so a typo is found at once instead of silently ignored.
- Very long, append-only lists (ledgers, logs, chat) use `cursor` and `limit` instead of pages and return `nextCursor`.

## Writes

1. **Version on every update.** `PATCH` and action bodies carry the `version` the client last saw. A mismatch returns `STALE`.
2. **Idempotency on anything that must not happen twice.** Routes marked *idempotent* in a module spec require an `Idempotency-Key` header (a UUID made by the client per user action). A repeat with the same key returns the first response. The api-client sets this automatically and reuses the key when it retries.
3. **One transaction per request.** Either everything the request did is saved, including its audit entry and queued jobs, or nothing is.
4. **Server fills in the facts.** The client never sends `orgId`, `createdBy`, totals, statuses or numbers. They are derived on the server.
5. **Bulk calls report per item.** `POST /things/bulk` returns `{ succeeded: […], failed: [{ index, code, message, fields }] }` with status `200`. One bad row never undoes the good ones.

## Files

1. `POST /files/uploads` with `{ purpose, fileName, mimeType, size }` → `{ fileId, uploadUrl, expiresAt }`.
2. The client uploads the bytes straight to Storage with `uploadUrl`.
3. `POST /files/[id]/confirm` → the server checks size and type against what was promised and marks the file ready.
4. The file id is then sent in the body of whatever record it belongs to.
5. `GET /files/[id]/url` → a signed download link valid for 5 minutes.

Limits per purpose (photo 2 MB, document 10 MB, import 20 MB, textbook 50 MB) and allowed types are in [13](13-notifications-jobs-and-files.md).

## Downloads and exports

- `GET /things/export?format=csv|xlsx&…filters` returns the file directly up to 5,000 rows.
- Above that it returns `202` with `{ exportId }`; the file is built by a job and the user is notified. `GET /exports/[id]` gives its status and download link.
- PDFs follow the same pattern: single documents are returned directly, batches are jobs.

## Rate limits

| Kind of route | Limit |
|---|---|
| Sign-in, one-time code, password reset | 5 per 15 minutes per identifier and per IP |
| Public forms (enquiry, admission) | 10 per hour per IP |
| Ordinary reads | 300 per minute per user |
| Ordinary writes | 120 per minute per user |
| Bulk, export, AI | 10 per minute per user |

A blocked request returns `429` with a `retry-after` header.

## Access cells

| Cell in a route table | Meaning |
|---|---|
| A permission key | Signed-in member of an organisation holding that permission |
| `signed-in` | Any signed-in member; the service applies its own ownership rule |
| `public` | No session; rate-limited by IP; never returns private data |
| `platform` | Takhti staff only |
| `webhook` | An outside system; the signature is verified against the raw body |

## Headers

| Header | Direction | Purpose |
|---|---|---|
| `Authorization: Bearer <token>` | In | Mobile apps and the sync upload. The web app uses its cookie |
| `Idempotency-Key` | In | See above |
| `x-request-id` | Both | Traces one request through logs and audit |
| `x-branch-id` | In | The branch the user is working in, for users with several. The server checks it against their access |
| `Accept-Language` | In | `en` or `ur`, for messages |
| `retry-after` | Out | With `429` |

## Versioning

- `/api/v1` only grows. Fields and routes are added; none is removed or changed in meaning.
- A breaking change means `/api/v2` for that resource, with `v1` kept until the oldest supported mobile app no longer calls it.
- Mobile apps send `x-app-version`. The API can answer `426` with a "please update" message for versions that are too old.

## Health

- `GET /api/health` → `200` if the process is up.
- `GET /api/ready` → `200` only if the database answers and migrations are current.

## Documentation

An OpenAPI document is generated from the contracts and the route registry (`pnpm api:docs`) and served at `/api/v1/docs` in non-production environments. The generated [routes index](../30-reference/routes-index.md) lists every route in this plan.
