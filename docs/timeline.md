# Development Timeline

## Phase 0 - Project Foundation

Status: foundation implemented; source and quality checks verified on 2026-09-06.

- [x] Initialize Next.js project
- [x] Add TypeScript, lint, test, and typecheck commands
- [x] Add Docker Compose PostgreSQL service
- [x] Add Prisma schema foundation
- [x] Add first TDD example for RAG export rules
- [x] Document local setup and development notes

The 2026-05-13 log records a running DB and applied migration in the old
environment. That runtime state is not assumed for a new checkout or computer.

## Phase 1 - Data Model and API Foundation

Status: Phase 1 technical acceptance complete on 2026-09-06 using the
user-approved native PostgreSQL 17 mode. Integration passed, the branch was
pushed, and independent agent code review completed with its one finding fixed
and rechecked. [PR #1](https://github.com/jason310chg-creator/NCKU-RAG/pull/1)
was merged into master at `2cf9d027fdc163a8bf7a198cbbe621e6aa921999` on
2026-09-07 (Asia/Taipei). Docker's
Linux engine remains unavailable in this VM and is not certified by native tests.

- [x] Initial migration exists: `20260512175544_init` (present before this work)
- [x] Validate schema and generate Prisma client locally
- [x] Add lazy Prisma client with development hot-reload reuse
- [x] Build public document list API with filters, pagination and stable ordering
- [x] Build public document detail API with UUID validation and uniform 404
- [x] Add strict Zod validation and explicit response serialization
- [x] Separate public policy from future departmental RAG eligibility
- [x] Define inclusive Taipei DATE boundaries in tests and API documentation
- [x] Add domain, validation, repository-contract, service, singleton and HTTP unit tests
- [x] Add isolated Compose test service and repeatable real PostgreSQL fixtures
- [x] Pass test, typecheck, lint and production build
- [x] Provide explicit native PostgreSQL 17 mode when Docker cannot run
- [x] Execute real PostgreSQL integration tests (18 passed)
- [x] Verify migration application in the isolated PostgreSQL test database
- [x] After integration tests pass, push the Phase 1 branch and complete code review

## Phase 2 - Admin Data Management

### Phase 2A - CI, Google OAuth, allowlist and RBAC

Status: implementation and local technical acceptance completed on 2026-09-07
on `feat/phase-2a-auth-foundation`, based on merged master
`2cf9d027fdc163a8bf7a198cbbe621e6aa921999`. Independent code review found no
remaining code blocker after the Unicode trim and safe error-boundary fixes.
163 Vitest tests, 9 runner safety tests, 79 real PostgreSQL tests and 13
production HTTP checks passed; clean install/generate/typecheck/lint/build passed.
Hosted CI and maintainer review remain pending. Real Google consent/callback
and intended HTTPS/browser behavior are required manual checks before deployment.
Work stops here: no push, merge, deployment, settings change or Phase 2B work.

- [x] CI workflow created: clean install, generated Prisma client, unit/SQL tests, typecheck, lint, build
- [x] Better Auth Google-only login linked to existing UUID User records
- [x] Add auth schema through migration; verify fresh PostgreSQL and Phase 1 regression
- [x] Exact normalized active-email allowlist; verified Google email required
- [x] Central server DAL rereads active status and Role for every protected request
- [x] Idempotent, explicit first-admin bootstrap without passwords
- [x] Minimal `/login`, `/admin` and logout flow
- [x] Security tests and operational documentation, including manual Google acceptance checklist
- [ ] Hosted GitHub Actions run and maintainer review (requires separately authorized remote work)
- [ ] Real Google consent/callback and HTTPS browser acceptance before deployment

### Phase 2B - Document management APIs, versions and audit

Status: pending; explicitly out of this request. Requires completed Phase 2A.
Planned: draft/list/detail APIs, publish/archive transitions, expectedVersion
and atomic version increments, user management, transactional audit, final-admin
protection, http/https URLs and same-origin JSON mutations. No hard delete.

### Phase 2C - Admin UI

Status: pending. Document list/create/edit, user and audit pages; filtering,
pagination, role/status badges, explicit save, unsaved changes, archive
confirmation, conflict feedback and loading/empty/error states. Plain text only.

### Phase 2D - Integration acceptance and hardening

Status: pending. Full Admin/Editor browser lifecycle, publication/public API
regression, transactional audit, stale-version rejection, suspension/session
revocation, security hardening and final documentation.

## Phase 3 - Files and Search

Status: pending

- [ ] Add local file upload storage
- [ ] Parse TXT and Markdown first
- [ ] Add PDF and DOCX parsing
- [ ] Add keyword search over title and content
- [ ] Add tests for upload validation and search behavior

## Phase 4 - RAG Export MVP

Status: pending

- [ ] Define API-key scopes and authorize department-only access explicitly
- [ ] Add API-key protected RAG export endpoint
- [ ] Return normalized text and metadata
- [ ] Exclude draft, archived, future, expired, and admin-only records
- [ ] Add endpoint tests for export eligibility

## Maintenance follow-up

- [ ] Review dependency audit findings (2026-09-06: 19 total; 15 high, 3 moderate,
  1 low). Dependency upgrades are separate from this API foundation change.
