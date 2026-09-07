# Development Log

## 2026-09-07

### Phase 2A - hosted acceptance and independent review follow-up

- After initial local acceptance, the user authorized steps 3–5: pushed
  `feat/phase-2a-auth-foundation`, opened [PR #2](https://github.com/jason310chg-creator/NCKU-RAG/pull/2)
  as a draft against `master`, and waited for hosted GitHub Actions to finish.
  Both initial commits were published through HEAD
  `ed2cd8231acd22127e40ee2a814895afdbde5ad2`.
- [Run 34071337902](https://github.com/jason310chg-creator/NCKU-RAG/actions/runs/34071337902)
  succeeded on that HEAD. The Ubuntu 24.04 job took 1m01s: clean install,
  Prisma generation, 163 unit tests / 15 files, 9 runner-safety checks, real
  Docker PostgreSQL startup, both migrations, 79 integration tests / 4 files,
  typecheck, lint and production build all passed. Local Docker remains
  unavailable in this VM, but the hosted Docker test path is now proven.
- The user independently reproduced unit/safety, types/lint, exact package pins,
  the original 42-file diff and the 19 dependency audit findings. Their review
  reported no merge-blocking code issue and identified stale documentation of
  push/PR/hosted acceptance. The supplied review is not a GitHub approval event.
- Corrected current acceptance, timeline, handoff, API, auth and scope documents;
  the prior local-only entry below is historical and describes its earlier
  checkpoint. Recorded the hosted run with its actual tested SHA rather than
  attributing it to later documentation commits. Current HEAD checks live on
  the PR. The requested review handoff is to mark PR #2 ready after this
  documentation update is pushed and its own hosted checks pass.
- Documented malformed legacy-email migration failures and required each future
  protected page/handler/action/mutation to call its own DAL guard in AGENTS.md.
  The overall diff now contains 43 files because AGENTS.md is newly changed.
  Kept Better Auth exactly pinned to 1.7.3 and all application/migration code intact.
- Recorded non-blocking diagnostics, session-policy, Prisma error classification,
  response-header and shared rate-limit follow-ups in auth.md. Verified two
  details in pinned source before documenting: DAL reads suppress session
  renewal, but raw HTTP get-session can renew; the library's 429 header is
  X-Retry-After and the wrapper retains numeric 429 while dropping headers.
- Validation for this documentation-only update: check whitespace, compare the
  changed-file inventory and confirm there is no runtime/schema/package change;
  the pushed HEAD must complete the existing hosted CI workflow before the
  requested Ready-for-review transition. Real Google consent/callback and
  intended HTTPS browser acceptance remain open. No merge, deployment, settings
  change or Phase 2B implementation is included.

### Phase 2A - Google identity foundation and local acceptance

Historical checkpoint: this entry predates the authorized push/PR/hosted run
described above; its no-remote-action statements apply only to that checkpoint.

- Read the repository instructions, roadmap, log, timeline and README; read
  installed Next 16.2.6 route/page/headers/authentication/forbidden documentation
  before implementing framework boundaries. The user's new specification
  supersedes historical password-login suggestions and ends after Phase 2A.
- Verified PR #1 merged and created `feat/phase-2a-auth-foundation` from master
  `2cf9d027fdc163a8bf7a198cbbe621e6aa921999`. No existing user edits were present.
  No push, merge, deployment, repository settings change or Phase 2B work occurred.
- Added a clean GitHub Actions pipeline: Node 24, locked install, explicit Prisma
  generation, unit/safety tests, disposable Docker PostgreSQL tests, types, lint
  and production build. Actions are pinned to release commit SHAs, permissions
  are read-only and checkout does not persist credentials. Hosted CI was not run.
- Pinned Better Auth 1.7.3 after checking installed provider/adapter/linking APIs.
  Google OAuth is the only public login flow; exact method/path and Origin gates
  exclude all passwords, signup, direct ID-token login and self-management.
  JWT signature/issuer/audience/age/expiry and fresh verified email are checked
  before matching an active precreated UUID. Returning linked accounts must
  still map to that same allowlist UUID. User creation is unconditionally denied.
- Added explicit UUID Account/Session/Verification schema and migration
  `20260907000000_phase2a_auth`, preserving Phase 1 content and ownership. Existing
  users become inactive; canonical email collisions abort the entire migration.
  Review found POSIX whitespace differs from JavaScript trim: replaced it with
  an explicit ECMAScript set and proved NBSP/BOM collision rollback in real SQL.
- Added first-Admin CLI with explicit email/name, no password, transaction
  advisory lock, UUID preservation and idempotency. Real SQL tests cover same
  and different-email races and reject unintended elevation/reactivation.
- Added fresh server DAL/RBAC, minimal login/admin/logout pages and explicit
  Next authInterrupts for actual 403 responses. Unexpected auth/DB errors remain
  failures; server boundaries sanitize them so Next cannot log raw SQL/secrets.
  Known authentication/authorization errors retain their 401/403 semantics.
- TDD evidence: config, bootstrap, DAL and UI/route suites first failed on absent
  modules. The actual UUID callback proof initially found Better Auth's stale
  local `emailVerified` read after linking when its built-in verification option
  was set. Removed that redundant option while retaining fresh Google JWT/email
  verification, UUID binding and a fresh session-create check. The isolated
  real-PG callback proof then passed (1 selected test) before broader acceptance.
  No open registration or identity model change was used. Additional safe-error
  boundary tests produced 9 failures before their implementation, then passed.
- Final verification after clean `npm.cmd ci` and `npm.cmd run db:generate`:
  **163 Vitest tests / 15 files**, **9 runner safety tests**, **79 real PostgreSQL
  integration tests / 4 files** (49 auth, 6 bootstrap, 6 migration, 18 unchanged
  Phase 1 API regressions); Prisma validate, typecheck, lint and build all pass.
  Native PostgreSQL 17.11 started from blank data, deployed both migrations,
  reported up-to-date, and stopped/removed its owned cluster after exit 0
  (`%TEMP%/ncku-rag-pg-s3x2LE`). No development database was touched.
- 13 actual production HTTP checks passed: login 200; missing config 500;
  password 404; public invalid input 400; anonymous admin redirect; Viewer and
  inactive 403; Editor/Admin 200; same-cookie demotion/deactivation immediately
  denied; logout succeeded and old cookie redirected to login. This used another
  fresh owned PostgreSQL cluster and runtime-only synthetic session fixtures,
  then stopped both app processes and removed the cluster. This is HTTP page
  boundary verification, not real Google consent/callback or TLS browser testing.
- Independent final review reported no remaining code blockers. Auth access/
  refresh tokens are encrypted; ID/session tokens still require protected DB
  storage. Locale-specific non-ASCII legacy email casing requires operator
  review before migration. Better Auth linking and Next authInterrupts need
  regression testing on upgrades. Existing dependency audit remains 19 findings
  (15 high, 3 moderate, 1 low), unchanged after install; no forced upgrade.
- Local implementation is ready for maintainer code review. Formal merge-ready
  status still needs remote CI/review, which are outside current authorization.
  Genuine Google consent/callback and intended HTTPS cookie/browser behavior
  remain explicit pre-deployment acceptance; no real credentials were supplied.
  No persistent real Admin was created without the user's explicit identity.

### Commands used for Phase 2A

```powershell
git fetch origin
git switch -c feat/phase-2a-auth-foundation origin/master
npm.cmd install --save-exact better-auth@1.7.3
npm.cmd install --save-dev --save-exact tsx jose
npm.cmd install --save-dev --save-exact pg@8.23.0 @types/pg@8.23.1
npm.cmd exec prisma format
npm.cmd exec prisma validate
npm.cmd run db:generate
npm.cmd exec vitest run -- --config vitest.integration.config.ts tests/integration/auth.integration.test.ts
node node_modules/vitest/vitest.mjs run src/lib/auth/config.test.ts
node node_modules/vitest/vitest.mjs run src/lib/auth/bootstrap.test.ts
node node_modules/vitest/vitest.mjs run src/lib/auth/dal-core.test.ts src/lib/auth/policy.test.ts
node node_modules/vitest/vitest.mjs run src/lib/auth/dal.test.ts src/lib/auth/dal-core.test.ts
npm.cmd ci
npm.cmd run db:generate
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PG_BIN = 'C:\Users\jason\AppData\Local\NCKU-RAG\tools\postgresql-17.11-3\pgsql\bin'
npm.cmd run test:integration -- --native
node C:\Users\jason\AppData\Local\Temp\ncku-rag-http-smoke-oPeC3V\smoke.mjs
```

The direct integration command above was the initial missing-module red check,
not a bypass of database isolation. Real SQL acceptance always used the owned
native runner. The first UUID proof used a temporary copy of that runner with
Vitest arguments `tests/integration/auth.integration.test.ts -t "links a
pre-created UUID Editor"`; the temporary runner was removed afterward. Its first
failed run's stopped diagnostic cluster remains at `%TEMP%/ncku-rag-pg-exCsDv`.
Successful full acceptance cleans its cluster. The one-time HTTP smoke harness
is local in `%TEMP%`, uses generated runtime-only secrets and is not a CI script.
The runner internally executes these commands against its fixed isolated URL:

```powershell
node node_modules/prisma/build/index.js migrate deploy
node node_modules/prisma/build/index.js migrate status
node node_modules/vitest/vitest.mjs run --config vitest.integration.config.ts
```

Bootstrap CLI negative checks also ran with no args, missing DATABASE_URL and
an invalid test URL: each exited 1 without disclosing the test secret marker.
Successful bootstrap/idempotency/concurrency are covered by the real SQL suite.

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
