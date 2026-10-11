# 10 · Security and privacy

Takhti holds children's records, family phone numbers, identity numbers and money. These rules are not optional.

## Sign-in and sessions

| Rule | Detail |
|---|---|
| Passwords | Minimum 10 characters for staff, 6 for student PINs; checked against a list of common passwords; never stored by us (Supabase Auth hashes them) |
| Two-factor | Authenticator-app codes. Compulsory for `owner`, `finance_head`, `accountant`, `payroll_officer` and all platform staff; optional for others |
| One-time codes | 6 digits, valid 5 minutes, single use, 5 attempts |
| Lockout | 5 failed sign-ins lock the identifier for 15 minutes; the user is told how long |
| Session | Access token 1 hour, refreshed silently; refresh token rotates; idle staff sessions end after 12 hours, family sessions after 30 days |
| Sign out everywhere | Available to every user, and done automatically when a password, phone number or role changes |
| New device | The user is notified in-app and by message |
| Invitations | Single-use link, valid 7 days, stored as a hash |
| Account states | `invited`, `active`, `suspended`. A suspended member is refused on their very next request |

## Authorisation

1. Two walls: permission and scope checks in services, and row-level security in the database ([06](06-tenancy-roles-and-access.md)).
2. The API's database role cannot bypass row-level security and has no rights outside a request transaction.
3. Supabase's own Data API (PostgREST and GraphQL) is switched off. Takhti's API is the only way to data, so no rule in a service can be stepped around. A visitor who is not signed in holds no privilege on any table.
4. A record a user may not see answers `404`, not `403`, so its existence is not revealed.
5. Nobody approves their own request (leave, discount, expense, payroll, result publishing).
6. High-risk actions ask for the password or two-factor code again: changing bank details, paying payroll, refunding, deleting a student, changing roles, exporting everything.

## Web protections

| Threat | Defence |
|---|---|
| Cross-site request forgery | Session cookies are `SameSite=Lax`, `HttpOnly`, `Secure`; every mutating request that relies on the cookie must carry an `Origin` that matches the app |
| Spreadsheet formula injection | A cell in an export that starts with `=`, `+`, `-` or `@` is written as text |
| Cross-site scripting | React escapes output; no `dangerouslySetInnerHTML` except through one sanitiser used for rich text (notices, lesson plans); a strict Content-Security-Policy |
| Clickjacking | `frame-ancestors 'none'` |
| SQL injection | Queries are built by Drizzle with parameters; raw SQL only through the tagged template, never string concatenation |
| Mass assignment | Bodies are parsed by a contract that lists allowed fields; unknown fields are rejected |
| Open redirects | Redirect targets after sign-in must be same-origin paths |
| Enumeration | Sign-in and reset answer the same way whether or not the account exists |
| Brute force and scraping | Rate limits ([08](08-api-standards.md)); public forms add a proof-of-humanity check in production |
| Insecure direct object access | Every read goes through a service that applies scope; ids are random UUIDs |

Security headers set once in `next.config.ts`: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.

## Files

- Buckets are private. Every download is a signed link that expires in 5 minutes.
- Type is checked by extension, declared type and the file's first bytes. Allowed: images (JPEG, PNG, WebP), PDF, CSV, XLSX, DOCX; nothing executable.
- Images are re-encoded on upload, which strips metadata such as location.
- File names are generated; the original name is kept only as a label.
- A virus scan hook is called before a file is marked ready (a no-op adapter locally; a real scanner in production).

## Personal data

| Data | Handling |
|---|---|
| CNIC, B-Form, bank account numbers | Shown masked (`35202-*******-1`) unless the user holds `…:read-sensitive`; revealing one is audited |
| Medical notes, behaviour concerns, counselling notes | Their own permissions; never in exports by default; never in AI context unless the user's role may see them |
| Photos of children | Private bucket; visible only to staff with access to the student and to the child's own guardians |
| Phone numbers | Never in logs; exports containing them are audited with the row count |
| Passwords and one-time codes | Never logged, never emailed in plain text |
| Integration secrets (gateway keys, SMS keys) | Encrypted with AES-256-GCM using a key from the environment; shown write-only in the UI |

### Children

- A student login shows only that student's own data and school-wide notices.
- Students cannot message staff privately. Messaging is between guardians and staff, and is visible to a supervising role.
- Student photos are never used on the public school website without a recorded consent flag.

### Retention

| Data | Kept |
|---|---|
| Student academic record, results, certificates | Indefinitely (schools must answer verification requests years later) |
| Financial records, journals, payslips | 7 years after the fiscal year |
| Audit log | 7 years |
| Messages and delivery logs | 2 years |
| GPS pings | 90 days |
| Sign-in events | 1 year |
| Soft-deleted rows | Purged after 30 days where no law or foreign key requires them |

A school group that leaves gets a full export, then its data is deleted after a 60-day grace period, and the deletion is recorded.

## Platform staff

- Two-factor is compulsory. Access is from named accounts only; no shared logins.
- Support access to a school is time-boxed, has a stated reason, is visible to the owner and is read-only by default ([M01](../10-modules/m01-platform-console.md)).
- Production database access outside the app is limited to two named people and logged.

## Secrets and configuration

- Secrets live in environment variables, never in the repository. `.env.example` lists every name with a description and no values.
- The service-role key and `DATABASE_ADMIN_URL` are used only on the server and by the worker. A lint rule fails the build if either name appears in client code.
- Keys can be rotated without downtime: the app reads them at start, and two encryption keys can be active during rotation.

## Dependencies and build

- Exact versions only. `pnpm audit` runs in the check pipeline; a high-severity finding blocks release.
- No package is added without a stated reason in the commit message.
- The lockfile is committed and installs use `--frozen-lockfile`.

## AI-specific rules

- A model sees only what the asking user may see, because its tools are the same services called with the user's `ctx`.
- Text from documents, messages and the web is treated as data, never as instructions to the model.
- No student's identity number, phone number or medical note is sent to the model unless the feature needs it and the user's role allows it.
- Every AI output that will be stored or sent is a draft until a person approves it. See [15](15-ai-design.md).

## Pakistan's data rules

A draft national data policy (July 2026) may later require sensitive personal data to be hosted inside Pakistan. Until that is settled:

1. Every component stays self-hostable, so the service can move to a data centre in Pakistan without a rewrite.
2. The production region is chosen in Phase 21 with this in mind.
3. The privacy notice tells schools where data is stored.

## Security checks before launch (Phase 21)

- [ ] Row-level security test passes for every table: other organisation, other branch, family user, signed-out.
- [ ] The Data API is switched off in the cloud project, and `anon` holds no table privilege.
- [ ] The `takhti_api` role has a statement timeout and an idle-in-transaction timeout, tested with the real driver.
- [ ] A permission test exists for every route.
- [ ] An outside review or a structured self-review against the OWASP Top 10 and the ASVS level 2 checklist.
- [ ] Rate limits verified under load.
- [ ] Backups restored successfully to a scratch project.
- [ ] Secrets rotated from development values.
- [ ] Privacy notice and terms reviewed.
