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
- Phase 1 API implementation and unit/build checks are complete; real PostgreSQL
  integration acceptance is blocked by the Docker engine in the 2026-09-06
  Windows VM. Docker Desktop 4.89.0 is installed per user, but reports
  `hasNoVirtualization: true`; WSL is also absent. Enable nested virtualization
  on the host and install WSL 2 before retrying. The Docker CLI directory is
  `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin`; open a new terminal
  if the current process predates its addition to the user PATH.
- Push the Phase 1 branch only after integration tests pass, then complete code
  review. Do not begin Phase 2 until Phase 1 acceptance is complete.
- Read `docs/api.md` for snake_case API names and inclusive Taipei DATE semantics.
- Run `npm run db:generate` after installing dependencies in a fresh checkout.
- `npm run test:integration` uses only the disposable test DB on localhost `55433`.
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
