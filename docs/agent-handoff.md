# Agent Handoff

Use this when you want any coding agent to enter the project state quickly.

## Copy/Paste Prompt

```text
You are working in `c:\Users\jason\Documents\projects\agent`.

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

## Expected Agent Startup Behavior

The agent should:

1. Read the handoff files.
2. Check local tool availability only when relevant to the task.
3. Report a concise status summary.
4. Continue with implementation if the user asked for work, not just planning.
5. Run suitable verification commands before final response.
6. Commit meaningful completed work to Git.
