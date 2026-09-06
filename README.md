# Knowledge Base Data Platform

RAG-ready data management platform for department knowledge. Phase 1 implements
public read-only document list and detail APIs. Real PostgreSQL integration
acceptance is pending local Docker availability. Admin management, search and
RAG export are later phases; chatbot and embeddings are not implemented.

See [API contract and tests](docs/api.md) and [phase status](docs/timeline.md).

## Tech Stack

- Next.js 16 App Router
- TypeScript
- PostgreSQL
- Prisma
- Tailwind CSS
- Vitest
- Docker Compose

## Local Setup

Install dependencies:

```bash
npm ci
```

Copy environment variables:

```bash
copy .env.example .env
```

Start PostgreSQL:

```bash
docker compose up -d
```

The project maps PostgreSQL to host port `5433` to avoid colliding with a
locally installed PostgreSQL on the default `5432` port.

Generate Prisma client:

```bash
npm run db:generate
```

Run database migrations after schema changes:

```bash
npm run db:migrate
```

Start the development server:

```bash
npm run dev
```

On Windows PowerShell, if `npm` is blocked by execution policy, use `npm.cmd`
instead, for example `npm.cmd run dev`.

## Quality Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:integration
```

Generate the Prisma client before typecheck/build in a fresh checkout. The
integration command requires Docker Compose and starts only a disposable test
database on localhost port `55433`; it does not use `.env` or the development
database on `5433`. See [API testing](docs/api.md#local-verification).

## Development Rules

- Use TDD for new features.
- Do not hide errors with fallback data.
- Keep a development record in `docs/development-log.md`.
- Keep timeline and milestone notes in `docs/timeline.md`.
- Record meaningful completed work with Git commits.
- RAG export must only expose published, valid, allowed-visibility records.
