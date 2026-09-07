<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. APIs, conventions, and file structure may
differ from older Next.js versions. Read the relevant guide in
`node_modules/next/dist/docs/` before writing Next.js route, layout, API,
metadata, caching, or rendering code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project Agent Instructions

## First Response Checklist

When starting work in this repository, read these files before making changes:

1. `docs/project.md` - product requirements and project rules
2. `docs/development-log.md` - what has already been done and why
3. `docs/timeline.md` - current phase and next planned work
4. `README.md` - local setup and command reference

After reading, briefly report:

- Current project phase
- Relevant recent changes
- What you will do next
- Any blocked tooling or environment issue

## Product Direction

This project is a RAG-ready knowledge base management platform. Phase one is
not an AI chatbot. The priority is data creation, classification, publishing,
search, and export APIs that future RAG indexing can consume.

Core rule: RAG export must only expose records that are published, still valid,
and allowed by visibility rules.

## Tech Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- Vitest
- Docker Compose

Use `npm.cmd` on Windows PowerShell if `npm` is blocked by execution policy.

## Development Rules

- Use TDD for new functionality.
- Do not hide errors with fallback data or silent defaults.
- Prefer clear failures over guessed behavior.
- Update `docs/development-log.md` whenever meaningful work is completed.
- Update `docs/timeline.md` when phase status or planned scope changes.
- Record meaningful completed work with Git commits so project history remains
  traceable.
- If required tooling is missing, explicitly tell the user what is missing.
  Do not fake package managers, Docker behavior, framework files, or generated
  output.
- Before editing Next.js 16 route, layout, API, or metadata behavior, check the
  relevant local docs under `node_modules/next/dist/docs/`.
- Every protected admin page must call the appropriate server DAL guard itself
  (`requireEditor()` for general admin entry, `requireAdmin()` for admin-only
  functions). Protected Route Handlers, Server Actions and mutations need their
  own guard too. A parent layout, Proxy, hidden UI or an earlier page check is
  not an authorization boundary; layouts do not re-run on every navigation.
- Keep Better Auth pinned exactly to `1.7.3` until a deliberate upgrade is
  reviewed with the UUID linking, fresh Google identity, closed provisioning,
  session and RBAC regression tests. Do not relax provisioning to make an
  upgrade work or infer authority from provider/client/session role fields.

## Common Commands

```bash
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run db:generate
npm.cmd run db:migrate
docker compose up -d
docker compose ps
```

## Local Environment Notes

- PostgreSQL is mapped to host port `5433` because the user's machine already
  has another PostgreSQL process on `5432`.
- `.env` is local-only and should not be committed.
- `.env.example` is the shared environment template.
