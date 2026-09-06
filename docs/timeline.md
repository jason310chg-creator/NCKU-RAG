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
is open for maintainer review; no merge or deployment has occurred. Docker's
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

Status: pending; not started during Phase 1 acceptance. When Phase 2 begins,
start with authentication and role authorization design and tests before
exposing administrative data or write operations.

- [ ] Build admin dashboard layout
- [ ] Build document list page
- [ ] Build create and edit document forms
- [ ] Add category, tag, source, visibility, and status controls
- [ ] Add basic role-aware access checks

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
