# Public Document API v1

Implemented: `GET /api/v1/documents` and `GET /api/v1/documents/{id}`.
All 18 integration tests pass against native PostgreSQL 17.11 on Windows.
Unit/HTTP tests and production build pass. Search, writes, login, uploads and
RAG export endpoints are not implemented.

## Contract and access policy

Request parameter names and JSON fields use **snake_case**, matching
`docs/project.md`. TypeScript and Prisma use camelCase internally; serialization
is the explicit boundary. Enum values retain their schema spelling.

Both endpoints require `status = published`, `visibility = public`, and current
validity. No query parameter widens access. Unknown or repeated list parameters
(including `status`, `visibility`, and camelCase aliases) return 400. Filtering
occurs in the database query before pagination.

Validity fields are PostgreSQL `DATE`, not instants. Interpret them as Taipei
calendar dates (`Asia/Taipei`), including **both** the start date and the entire
end date. Null means the corresponding boundary is unbounded. For example,
`valid_until = 2026-05-13` remains available through Taipei 2026-05-13
23:59:59.999, then expires at Taipei 2026-05-14 00:00. `valid_from = 2026-05-13`
becomes available at Taipei 2026-05-13 00:00. Equality at both DATE boundaries
is allowed; this is not a timestamp comparison.

Prisma represents a DATE as a JavaScript Date at UTC midnight. Read its UTC
date components without converting that field into a Taipei instant. Convert
the request's current instant to a Taipei calendar date, then encode that date
as UTC midnight for SQL comparisons, independently of the server's timezone.
Serialize DATE values as `YYYY-MM-DD` or null, and `updated_at` as a UTC ISO
timestamp. `updated_after` is an instant, not a calendar date.

`isPublicDocument()` is the anonymous policy. `isRagExportable()` preserves the
existing public/department-only eligibility for a future **authorized departmental**
export and now applies both validity boundaries. It is not an authorization
check and is not used by public routes. Phase 4 must define API-key scopes before
using it; no RAG endpoint or department access is added here.

Responses use `Cache-Control: no-store`; Next.js routes are dynamic so cached
responses cannot extend validity or retain records after publication changes.

## GET /api/v1/documents

| Parameter | Validation / behavior |
| --- | --- |
| `category` | Exact match; trimmed nonempty string, maximum 200 characters |
| `subcategory` | Exact match; trimmed nonempty string, maximum 200 characters |
| `tag` | Exact tag-name match; trimmed nonempty string, maximum 200 characters |
| `content_type` | `faq`, `document`, `link`, or `structured` |
| `updated_after` | Valid ISO date-time with `Z` or an explicit offset; strictly greater than this instant |
| `limit` | Decimal integer, default 20, range 1–100 |
| `offset` | Decimal integer, default 0, range 0–2147483647 |

Category/subcategory are strings in the existing schema, not enums. Unknown
names return no matches. Supplied filters combine with AND. Blank values,
impossible calendar dates, date-times without timezone, fractions, exponent
notation and signed pagination values return 400. Encode the `+` in an offset
as `%2B` in a URL.

Order: `updated_at DESC, id ASC`. The count and page use one repeatable-read
transaction and the same captured current date. `total` counts eligible records
after filtering, before pagination. An offset past the end yields an empty page
with the original filtered total. Separate requests may see intervening writes;
this is offset pagination, not a persistent snapshot across requests.

Example response (illustrative data):

```json
{
  "data": [{
    "id": "a9cfbb80-8fa7-4e39-b842-4c6186d06053",
    "title": "修課說明",
    "content_type": "faq",
    "category": "department_cs",
    "subcategory": "course",
    "tags": ["大一", "必修"],
    "source_type": "official",
    "source_name": "資訊系",
    "source_url": null,
    "visibility": "public",
    "status": "published",
    "valid_from": "2026-05-13",
    "valid_until": null,
    "version": 1,
    "updated_at": "2026-05-13T02:00:00.000Z"
  }],
  "pagination": { "limit": 20, "offset": 0, "total": 1 }
}
```

Tags are names sorted by JavaScript string order. Optional source, subcategory
and validity fields remain null when absent; missing metadata is not invented.

## GET /api/v1/documents/{id}

Requires a UUID (case-insensitive input, normalized internally). Returns one
object without a `data` wrapper: the list metadata above plus `content`, the
full stored text or null when the schema's optional text is absent. Version is
the current version number; no revision-history feature is implied.
No owner IDs, user details, creation audit fields, files or storage URLs are
selected or returned. `source_url` is the intentionally public source citation.

Missing, draft, archived, future, expired, department-only and admin-only records
all return exactly the same 404 body. The lookup applies access predicates in
the same query; it does not first fetch a record to check existence.

## Errors

| Status | Body / behavior |
| --- | --- |
| 400 | `{"error":{"code":"invalid_request","message":"Invalid request parameters","issues":[{"field":"limit","message":"..."}]}}` |
| 404 | `{"error":{"code":"not_found","message":"Document not found"}}` |
| 500 | `{"error":{"code":"internal_error","message":"Internal server error"}}` |

Invalid input is rejected before creating the database client. Database failures,
missing `DATABASE_URL` and unexpected exceptions return 500 and are logged with
the original error server-side. They never become empty arrays or successful
responses. Internal exceptions are not sent to the anonymous caller. The list
returns 200 for a genuine query with zero matches, not 404.

## Local verification

```bash
npm ci
npm run db:generate
npm run test
npm run typecheck
npm run lint
npm run build
npm run test:integration
```

Use `npm.cmd` on Windows PowerShell. Unit tests need neither `.env` nor a DB.
Actual requests use the existing `.env.example`'s `DATABASE_URL`; there is no
fallback connection string. Build does not connect to a database.

By default, integration tests require Docker with Linux containers and Compose. The runner
starts only `postgres-test` on `127.0.0.1:55433`, applies checked-in migrations
using `migrate deploy`, checks migration status, runs real Prisma/HTTP tests,
then stops that service. It uses a separate `kb_platform_test` DB, a disposable
tmpfs volume and local trust authentication (no stored password). It never
resets the development service or uses a production URL. Both test environment
URLs must equal the fixed test address; arbitrary URLs are refused. Do not run
concurrent integration suites against this shared local test port. Each test
replaces only the isolated database's fixtures.

### Native PostgreSQL 17 on Windows

When Docker cannot run in a VM, use the explicit native mode with real
PostgreSQL 17 binaries. Download the Windows ZIP linked from
[PostgreSQL's Windows downloads](https://www.postgresql.org/download/windows/)
and [EDB binary downloads](https://www.enterprisedb.com/download-postgresql-binaries).
Extract it under a user-owned directory outside the checkout. No Windows
service, Docker or WSL is needed for this mode.

```powershell
# Point PG_BIN at the extracted pgsql\bin directory (absolute path).
$env:PG_BIN = "$env:LOCALAPPDATA\NCKU-RAG\tools\postgresql-17.11-3\pgsql\bin"
npm.cmd run test:integration -- --native
```

Native mode refuses an occupied test port and initializes a new PostgreSQL 17
cluster under the OS temporary directory for each run. It binds only to
`127.0.0.1:55433`, creates `kb_platform_test` as `kb_test`, and runs the same
migration deploy/status and integration suite. The runner and suite check the
connected cluster's data directory before writes. Inherited PostgreSQL
connection settings are removed; the fixed test URLs override `.env`.
Local trust authentication is for disposable fixtures only.

The runner stops its own cluster on exit. Successful runs remove their temporary
cluster; failures retain the directory and logs for diagnosis. An unconfirmed
shutdown never triggers directory deletion. Docker remains the default and
never silently switches to native mode. Neither mode should run concurrently
on the shared test port. A native pass verifies PostgreSQL/API behavior;
it does not certify the Docker Compose environment.

Normal SIGINT/SIGTERM cancellation attempts cleanup. Force-killing the runner
or shutting down Windows can bypass it; inspect the printed directory and use
`pg_ctl stop -D <that-run-data-directory> -m fast -w` before removing retained
data. Never stop another PostgreSQL process by name or reuse a retained cluster
for acceptance; rerunning native mode always creates a fresh one.

`npm run test` reports unit and mocked HTTP/repository-contract tests only.
`npm run test:integration` is real SQL acceptance; missing Docker or a failed
database startup produces a nonzero exit rather than a skipped pass.
