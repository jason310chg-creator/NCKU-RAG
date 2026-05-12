# Development Log

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
