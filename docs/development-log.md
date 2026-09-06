# Development Log

## 2026-09-06

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
