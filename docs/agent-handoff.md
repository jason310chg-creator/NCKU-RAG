# Agent Handoff

Use this when you want any coding agent to enter the project state quickly.

## Copy/Paste Prompt

```text
You are working in the actual checkout of `jason310chg-creator/NCKU-RAG`.
Confirm the repository root with `git rev-parse --show-toplevel` before editing.

Before changing code, read and summarize these files:

1. `AGENTS.md`
2. `docs/project.md`
3. `docs/development-log.md`
4. `docs/timeline.md`
5. `README.md`

After reading them, tell me:

- What the project goal is
- Which phase the project is currently in
- What was completed recently
- What the most reasonable next step is
- Any local tooling or environment notes I should know

For future development, follow these rules:

- Use TDD.
- Do not hide errors with fallback data.
- If a required tool is missing, tell me clearly. Do not fake package managers,
  Docker behavior, framework files, or generated output.
- Before changing Next.js 16 route, layout, API, metadata, caching, or rendering
  behavior, read the relevant local docs under `node_modules/next/dist/docs/`.
- Update `docs/development-log.md` after meaningful work is completed.
- Update `docs/timeline.md` when phase status or planned scope changes.
- Record meaningful completed work with Git commits.
```

## Short Prompt

```text
Read `AGENTS.md`, `docs/project.md`, `docs/development-log.md`,
`docs/timeline.md`, and `README.md` first. Enter the project state before
starting work. Follow TDD, do not hide errors with fallback data, and update
the development log after meaningful work. Record meaningful completed work
with Git commits.
```

## Current Project Snapshot

- Product: RAG-ready knowledge base management platform.
- Phase one excludes chatbot, embeddings, semantic search, and AI answering.
- Stack: Next.js 16, TypeScript, PostgreSQL, Prisma, Vitest, Docker Compose.
- Local PostgreSQL uses host port `5433`.
- On this Windows PowerShell setup, use `npm.cmd` if `npm` is blocked.
- Phase 1 API implementation, unit/build checks and 18 real PostgreSQL integration
  tests pass. The initial migration was applied and verified in a fresh native
  PostgreSQL 17.11 cluster on 2026-09-06. The user explicitly chose native mode
  because this Windows VM cannot expose nested virtualization to Docker.
- Docker Desktop 4.89.0 is installed per user, but reports
  `hasNoVirtualization: true`; WSL is also absent. Docker runtime validation
  remains unavailable; native mode validates the PostgreSQL/API contract.
- Native binaries are installed at
  `%LOCALAPPDATA%\NCKU-RAG\tools\postgresql-17.11-3\pgsql\bin`.
  Set `PG_BIN` to that absolute directory and run
  `npm.cmd run test:integration -- --native`. See `docs/api.md` for isolation,
  diagnostics and cleanup. Default `test:integration` still uses Docker.
- Phase 1 technical acceptance is complete: integration passed before push,
  independent agent code review found one Docker failure-cleanup issue, and
  the fix passed regression tests and re-review. Final checks: 58 Vitest tests,
  9 runner safety tests, 18 integration tests, typecheck, lint and build.
  [PR #1](https://github.com/jason310chg-creator/NCKU-RAG/pull/1) is open for
  maintainer review; no merge/deployment or Phase 2 work has occurred.
- Read `docs/api.md` for snake_case API names and inclusive Taipei DATE semantics.
- Run `npm run db:generate` after installing dependencies in a fresh checkout.
- Both integration modes use only the disposable test DB on localhost `55433`.
- The migration file already exists. Do not infer it has been applied locally
  from the historical development log; `.env` is not part of the checkout.

## Expected Agent Startup Behavior

The agent should:

1. Read the handoff files.
2. Check local tool availability only when relevant to the task.
3. Report a concise status summary.
4. Continue with implementation if the user asked for work, not just planning.
5. Run suitable verification commands before final response.
6. Commit meaningful completed work to Git.
