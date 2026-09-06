# Development Log

## 2026-09-06

### Phase 1 - pushed branch and completed code review

- After native integration and quality checks passed, committed the native
  runner at `ab1d12e` and pushed `feat/phase-1-api-foundation`. Opened
  [PR #1](https://github.com/jason310chg-creator/NCKU-RAG/pull/1) against `master`.
- Independent agent review covered the full Phase 1 diff from `828b1cb`,
  including public SQL eligibility, Taipei dates, filter/count consistency,
  privacy/serialization, input validation, Prisma and test-cluster lifecycle.
- Review found one P2 issue: Compose can start a container before `up --wait`
  fails its health check, but the old success-only flag skipped cleanup.
  Added a lifecycle helper that records attempted startup before waiting and
  attempts scoped `stop postgres-test` in finally. It does nothing if startup
  was never attempted, including native mode. The regression test failed with
  the old flag placement, then passed after the fix.
- Final verification after this fix: `npm.cmd run test` passed 58 Vitest and
  9 runner safety tests; lint passed. Native integration again applied the
  initial migration to a fresh PostgreSQL 17.11 cluster, confirmed schema up to
  date, passed all 18 tests, then stopped and removed its data directory
  (`%TEMP%\ncku-rag-pg-dGmo8t`, exit 0). Typecheck/build passed before this
  scripts-only cleanup fix; application code was unchanged by the fix.
- Reviewer rechecked the fix and reported no remaining actionable findings.
  Docker failure cleanup is covered at the command boundary; real Docker
  runtime and force-kill recovery remain unverified. Existing dependency
  audit findings remain separately tracked.
- Phase 1 technical acceptance is complete through the user-approved native
  PostgreSQL route. PR is ready for maintainer review. No merge, deployment,
  or Phase 2 implementation was performed.

### Phase 1 - native PostgreSQL integration acceptance

- User confirmed nested virtualization is unavailable and explicitly chose
  native Windows PostgreSQL instead of Docker. This verifies the Phase 1 SQL/API
  contract without changing the existing Docker default or claiming Docker works.
- Installed the real EDB PostgreSQL 17.11-3 Windows binary runtime under
  `%LOCALAPPDATA%\NCKU-RAG\tools\postgresql-17.11-3\pgsql` using the ZIP linked
  from PostgreSQL's official Windows downloads. No Windows service, administrator
  install, WSL, system PATH change or application dependency was needed.
  Runtime executables report PostgreSQL 17.11. Download SHA-256 (recorded for
  reproducibility, not a separately published signature verification):
  `4b8db0930c38f6ef845db919551dedda3b6b845aeb0927b3d79a6e8e9e4537cf`.
- Added explicit `npm.cmd run test:integration -- --native`, with absolute
  `PG_BIN`, PostgreSQL 17 version checks, scrubbed inherited PG connection
  settings, fixed loopback-only port 55433, and a new temporary cluster per run.
  Both runner and integration setup verify the owned data directory before
  writes. Existing databases are never reused; occupied ports fail explicitly.
- Success stops and deletes only the owned, verified-stopped cluster. Failures
  retain data and diagnostic logs; ambiguous shutdown prevents deletion.
  SIGINT/SIGTERM initiates cleanup. Forced termination can still bypass cleanup,
  as documented in `docs/api.md`.
- TDD: runner safety tests first failed because the helper did not exist;
  all 7 now pass, covering explicit options, connection redirects, occupied
  ports without connections, directory ownership, cluster identity and refusal
  to delete running/ambiguously stopped data. Included these in `npm run test`.
- Real Windows execution exposed a pg_ctl inherited-pipe hang after the server
  was ready. Fixed daemon startup to use file handles. The first diagnostic
  cluster was stopped after verifying its PID/data path; its failed-run logs
  remain in `%TEMP%\ncku-rag-pg-nWQQHl`. No migration was reached on that run.
- Final asynchronous runner verification: native PostgreSQL 17.11 started in
  fresh `%TEMP%\ncku-rag-pg-lJKglk`; `20260512175544_init` applied successfully,
  `prisma migrate status` reported schema up to date, and all 18 integration
  tests passed. The cluster stopped and its directory was removed; exit 0.
- `npm.cmd run db:generate`, `npm.cmd run test` (58 Vitest + 7 runner safety),
  `npm.cmd run typecheck`, `npm.cmd run lint` and `npm.cmd run build` passed.
  Updated setup, API documentation, timeline, handoff and homepage status.
  Read the installed Next.js page convention before editing homepage copy.
- Database acceptance is complete; next push this Phase 1 branch and complete
  code review. Phase 2 has not started. Existing dependency audit findings
  remain tracked as a separate maintenance follow-up.

### Phase 1 acceptance retry - Docker engine blocked

- Confirmed the actual repository root and clean branch
  `feat/phase-1-api-foundation` at `d77e7b9` before this retry.
- Found existing Docker Desktop 4.89.0 in
  `%LOCALAPPDATA%\Programs\DockerDesktop`. Its CLI directory is already in the
  persistent user PATH, but absent from this older shell's inherited PATH.
  Prepended that directory only for the verification command; no reinstall or
  persistent PATH change was needed. CLI is 29.7.2 and Compose is v5.5.0.
- Docker Desktop processes were already running. `docker desktop start
  --timeout 30` reported already running, while `docker desktop status`
  reported stopped. Backend logs explicitly report `hasNoVirtualization: true`
  and a stopped Linux engine. `docker version` returned an engine HTTP 500.
- Windows reports Microsoft Virtual Machine, HypervisorPresent true, and
  VirtualizationFirmwareEnabled / SecondLevelAddressTranslationExtensions
  false. `wsl --status` reports WSL is not installed. Attempting
  `wsl --install --no-distribution` in this non-administrator session did not
  install it; it returned the same not-installed message.
- `npm.cmd run test:integration` was executed with the real Docker CLI. It
  exited 1 because the Docker engine `_ping` endpoint returned HTTP 500 during
  Compose startup. No PostgreSQL test or migration command was reached; this
  is an environment failure, not a passing or skipped acceptance run.
- Required external remediation: enable nested virtualization on the VM host,
  then install WSL 2 with administrator privileges in Windows and restart as
  required. See [Docker VM prerequisites](https://docs.docker.com/desktop/setup/vm-vdi/)
  and [Microsoft WSL installation](https://learn.microsoft.com/en-us/windows/wsl/install).
  The host configuration is not accessible from this guest session.
- Updated README, timeline and handoff with the verified blocker. Only
  documentation changed; previously recorded unit/build checks were not rerun.
  No push, PR, code review, merge or Phase 2 implementation was performed.
  After environment repair, rerun integration (which starts only the isolated
  test service, deploys/checks migrations and runs the SQL suite), then push and
  complete code review before marking Phase 1 accepted.

### Phase 1 - public document API foundation

- Worked in the actual `NCKU RAG/NCKU-RAG` checkout on
  `feat/phase-1-api-foundation`, starting from clean `master` at `828b1cb`.
  The parent directory belongs to an unrelated Git worktree and was not changed.
- Read onboarding documents, all existing source/tests and schema/migration.
  Corrected the timeline: Phase 0 foundation and initial migration file were
  already implemented; no document API or reusable Prisma helper existed.
  Fixed the homepage's PostgreSQL-planned wording and the stale handoff path.
- Environment: Node `v24.19.0`, npm `11.17.0`; no Docker executable (including
  its standard Windows installation path), PostgreSQL CLI, local `.env` or
  initial node_modules. Installed locked dependencies with `npm.cmd ci`.
- Read installed Next.js 16.2.6 route-handler, route-convention and page docs
  under `node_modules/next/dist/docs/` before editing routes or the homepage.
- Added Prisma 7.8 PostgreSQL adapter and a lazy server-only client helper.
  Development hot reload shares one client through globalThis. Requests fail
  if DATABASE_URL is absent; importing/building never requires a database.
  Added explicit dotenv dependency for the existing Prisma config import.
  Followed the [Prisma Next.js guide](https://www.prisma.io/docs/guides/v7/frameworks/nextjs)
  for adapter and client-reuse patterns.
- Implemented GET list/detail with separate Zod validation, SQL query building,
  repository, service, allowlist serialization and HTTP error handling.
  Pagination defaults to 20, caps at 100, sorts updatedAt DESC then id ASC;
  page and count use the same repeatable-read transaction and date snapshot.
- Public queries require published/public and both valid dates before fetching
  data. Detail hides missing and ineligible records with the same 404.
  Unexpected errors are logged server-side and return generic 500, never fake
  success. Responses are dynamic/no-store and omit ownership and file fields.
- Naming decision: preserve snake_case in all public parameters and JSON as
  specified in project.md; internal TypeScript/Prisma remain camelCase.
  Category/subcategory remain free strings, matching the unchanged schema.
- DATE decision: use inclusive start/end Taipei calendar dates. PostgreSQL DATE
  values are read as UTC date components; compare against the current Taipei
  day encoded at UTC midnight. Separate isPublicDocument from the existing
  future departmental isRagExportable eligibility; the latter grants no access
  itself. API-key scopes are still Phase 4 work. See `docs/api.md`.
- TDD evidence: first run had missing validation module / public policy and
  failed RAG start-date boundary assertions (8 failing tests plus a failed
  suite). After implementation, 40 passed. Added service/HTTP tests, observed
  missing-module failures, then implemented those layers. Final unit coverage
  adds serialization allowlists, Prisma reuse, query contract and error checks.
- Added real PostgreSQL fixtures and an isolated Compose test profile on
  127.0.0.1:55433 with tmpfs storage, no stored password, fixed test-only URL
  guards and migration deploy/status steps. Tests replace only their isolated
  fixtures, verify all filters/visibility states, uniform HTTP 404, stable
  pagination and date boundaries. No production DB or existing manual data used.

### Verification and remaining blockers

- `npm.cmd run db:generate`: passed (Prisma Client 7.8.0).
- `npm.cmd exec prisma validate`: passed; schema unchanged.
- `npm.cmd run test`: passed, 58 tests across 7 files. These are unit / mocked
  HTTP and repository-contract tests, not PostgreSQL integration results.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed.
- `npm.cmd run build`: passed; list/detail appear as dynamic routes.
- Started the production server on 127.0.0.1:3107 for real HTTP smoke checks:
  invalid pagination and UUID returned JSON 400; valid list/detail requests
  without DATABASE_URL returned JSON 500. All four responses had no-store.
  This confirms routing/error behavior, not database integration.
- `npm.cmd run test:integration`: failed to start (`spawnSync docker ENOENT`).
  No real PostgreSQL test ran. Integration acceptance remains blocked.
- `npm.cmd exec prisma migrate status`: unavailable because DATABASE_URL is
  absent. The initial migration is present; its current DB application is not
  verified. The historical 2026-05-13 application claim refers to the old setup.
- `npm.cmd audit --json`: 19 findings (15 high, 3 moderate, 1 low), also reported
  by initial npm ci before adding the adapter. No forced upgrades performed.
- Phase 1 implementation is complete; database acceptance is explicitly pending.
  No schema change or immediate product decision required. After DB verification,
  Phase 2 should begin with authentication/role authorization and tests before
  administrative listings or writes. No push, merge or deployment performed.
- Local Git had no author identity. Used the repository's existing automation
  identity `Codex <codex@local>` through per-command Git configuration for this
  commit; no global or repository user identity setting was changed.

## 2026-05-13

### Project initialization

- Read `docs/project.md` and confirmed the product direction is a RAG-ready
  knowledge base management platform, not an AI chatbot in phase one.
- Verified local tooling:
  - Node.js: `v26.1.0`
  - npm: available through `npm.cmd` because PowerShell blocks `npm.ps1`
  - Docker: `29.0.1`
  - Git repository: not initialized yet
- Generated the project with `create-next-app@16.2.6` using TypeScript,
  App Router, ESLint, Tailwind CSS, and npm.
- Added Prisma, PostgreSQL configuration, Docker Compose, Zod, Vitest, jsdom,
  React Testing Library, and Jest DOM matchers.
- Initialized Prisma with PostgreSQL datasource and added first-pass schema
  models for users, documents, tags, document tags, and files.
- Added baseline domain logic and tests for RAG export eligibility.
- Replaced the default Next.js starter page with a project-specific status page.
- Started the PostgreSQL Docker service and applied the initial Prisma
  migration.
- Expanded `AGENTS.md` with project-specific onboarding rules and added
  `docs/agent-handoff.md` so future agents can quickly enter the project state.
- Added a project rule that meaningful completed work should be recorded with
  Git commits.

### Notes

- npm audit currently reports moderate vulnerabilities in installed
  dependencies. I did not run `npm audit fix --force` because it can introduce
  breaking dependency changes; this should be reviewed before version upgrades.
- `.env` is local-only and ignored by Git. `.env.example` is committed as the
  shared setup template.
- Host port `5433` is used for the project PostgreSQL container because this
  machine already has a local PostgreSQL process listening on `5432`.
- The first schema is allowed to change aggressively during pre-production,
  matching the project rule that early structural changes should prefer clean
  resets over migration compatibility work.

### Commands used

```bash
npx create-next-app@latest kb-platform --ts --eslint --app --src-dir --tailwind --use-npm --import-alias "@/*" --yes
npm install @prisma/client zod
npm install -D prisma vitest jsdom @testing-library/react @testing-library/jest-dom @vitejs/plugin-react
npx prisma init --datasource-provider postgresql
```
