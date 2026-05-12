# Development Timeline

## Phase 0 - Project Foundation

Status: in progress

- Initialize Next.js project
- Add TypeScript, lint, test, and typecheck commands
- Add Docker Compose PostgreSQL service
- Add Prisma schema foundation
- Add first TDD example for RAG export rules
- Document local setup and development notes

## Phase 1 - Data Model and API Foundation

Status: pending

- Create initial Prisma migration
- Add Prisma client helper
- Build document list API
- Build document detail API
- Add API validation with Zod
- Add tests for document filtering and status rules

## Phase 2 - Admin Data Management

Status: pending

- Build admin dashboard layout
- Build document list page
- Build create and edit document forms
- Add category, tag, source, visibility, and status controls
- Add basic role-aware access checks

## Phase 3 - Files and Search

Status: pending

- Add local file upload storage
- Parse TXT and Markdown first
- Add PDF and DOCX parsing
- Add keyword search over title and content
- Add tests for upload validation and search behavior

## Phase 4 - RAG Export MVP

Status: pending

- Add API-key protected RAG export endpoint
- Return normalized text and metadata
- Exclude draft, archived, expired, and admin-only records
- Add endpoint tests for export eligibility
