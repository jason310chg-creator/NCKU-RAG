# Phase 2A acceptance report — 2026-09-07

## 1. Branch and commits

- Branch: `feat/phase-2a-auth-foundation`.
- Base/master: `2cf9d027fdc163a8bf7a198cbbe621e6aa921999` (merged Phase 1 PR #1).
- Tested implementation commit: `4bee8d6eb1f4ebfef08ec32857d7463723816674` —
  `feat: add Phase 2A Google auth, UUID allowlist and RBAC`.
- Initial acceptance documentation commit:
  `ed2cd8231acd22127e40ee2a814895afdbde5ad2`. Both implementation and acceptance
  commits were pushed to `origin/feat/phase-2a-auth-foundation` with authorization.
- [PR #2](https://github.com/jason310chg-creator/NCKU-RAG/pull/2) was opened as a
  draft against `master`. Hosted CI passed on the initial acceptance commit;
  subsequent documentation updates do not change the tested application code.
  Use `git rev-parse HEAD` for the current checkout and the PR's Checks tab for
  the current remote HEAD; the run recorded below is tied to its explicit SHA.
- No merge, deployment or repository settings change has occurred. The working
  tree was clean before implementation and before this review follow-up.

## 2. Changed files

43 files relative to the base, including this report and the review follow-up
to `AGENTS.md`. The initial acceptance commit had 42 changed files.

```text
.env.example
.github/workflows/ci.yml
AGENTS.md
README.md
docs/agent-handoff.md
docs/api.md
docs/auth.md
docs/development-log.md
docs/phase2a-acceptance.md
docs/project.md
docs/timeline.md
next.config.ts
package-lock.json
package.json
prisma/migrations/20260907000000_phase2a_auth/migration.sql
prisma/schema.prisma
scripts/bootstrap-admin.ts
src/app/admin/forbidden.tsx
src/app/admin/page.test.tsx
src/app/admin/page.tsx
src/app/admin/sign-out-button.tsx
src/app/api/auth/[...all]/route.test.ts
src/app/api/auth/[...all]/route.ts
src/app/login/page.tsx
src/app/login/sign-in-button.tsx
src/lib/auth/bootstrap.test.ts
src/lib/auth/bootstrap.ts
src/lib/auth/client.ts
src/lib/auth/config.test.ts
src/lib/auth/config.ts
src/lib/auth/core.ts
src/lib/auth/dal-core.test.ts
src/lib/auth/dal-core.ts
src/lib/auth/dal.test.ts
src/lib/auth/dal.ts
src/lib/auth/email.ts
src/lib/auth/policy.test.ts
src/lib/auth/policy.ts
src/lib/auth/server.test.ts
src/lib/auth/server.ts
tests/integration/auth.integration.test.ts
tests/integration/bootstrap.integration.test.ts
tests/integration/migrations.integration.test.ts
```

Phase 1 public route/service/repository code and its integration tests are
unchanged. No document/user management API, AuditLog or Phase 2B UI was added.

## 3. Migration and database changes

`20260907000000_phase2a_auth` adds `User.emailVerified`, `image`, `isActive`
and UUID Account/Session/Verification tables. It retains User UUIDs/Role and all
Phase 1 document/tag/file data and relations. Provider+subject and session token
uniqueness, UUID foreign keys, cascades and indexes are explicit.

Email normalization keeps plus tags and dots. Explicit ECMAScript whitespace
matches JavaScript trim; collision failures roll back all migration changes.
Malformed legacy emails, including internal whitespace or values without exactly
one nonempty local/domain pair around `@`, also abort and roll back the migration.
Existing and new users default to inactive; a historical content owner gains no
implicit login access. Real SQL tests verify populated upgrades and rollback.
See [operational assumptions](auth.md#identity-and-database-guarantees) for legacy
non-ASCII casing and inactive existing Admin recovery considerations.

## 4. Authentication and RBAC

Better Auth **1.7.3**, Google-only authorization-code OAuth, Prisma PostgreSQL
adapter, persistent sessions and signed HTTP-only cookies. Every provider login
verifies signature/issuer/audience/expiry/age plus fresh verified email, requires
an existing active exact-email match, and binds the provider subject to that same
UUID. Registration and password/self-management endpoints are unavailable.

Precreated UUID linking was proven with the real Better Auth handler and adapter
before broader acceptance. The library's stale local email-verification read was
resolved using explicit verified-claim and fresh session-create gates, without
opening registration or changing identity models. See [the detailed rationale](auth.md).

The server DAL verifies the session and reloads current User role/active status
for every protected call. It supplies `getCurrentUser`, `requireUser`,
`requireEditor`, `requireAdmin`, and document read/edit policies. Missing session
is 401; denied role/inactive is 403. `/admin` redirects anonymous navigation to
login and returns actual 403 for denied identities. Unexpected database errors
remain generic 500 failures; secret-bearing exceptions are not propagated to
framework logs. Bootstrap is explicit, UUID-preserving, idempotent and serialized
with a transaction advisory lock. It creates no password or session.

## 5. Executed commands

Full setup/TDD and runner-internal commands are recorded in
[the development log](development-log.md#commands-used-for-phase-2a).
Final acceptance commands, from the repository root:

```powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd exec prisma validate
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
$env:PG_BIN = 'C:\Users\jason\AppData\Local\NCKU-RAG\tools\postgresql-17.11-3\pgsql\bin'
npm.cmd run test:integration -- --native
node C:\Users\jason\AppData\Local\Temp\ncku-rag-http-smoke-oPeC3V\smoke.mjs
git diff --check
```

The last Node command is the one-time local HTTP harness, retained outside the
repository. It creates only temporary synthetic test sessions, runs the built
production server and cleans up. It is not part of the hosted CI workflow.

## 6. Results and evidence

Local environment: Windows, Node **24.19.0**, npm **11.17.0**, Prisma **7.8.0**,
Next **16.2.6**, native PostgreSQL **17.11**. Clean install added 567 packages;
Prisma generation was explicit and succeeded without a precommitted client.

| Check | Result |
| --- | --- |
| Unit / mocked boundary suites | **163 passed**, 15 files |
| Integration-runner safety checks | **9 passed** |
| Real PostgreSQL OAuth/session/DAL | **49 passed** |
| Real PostgreSQL bootstrap | **6 passed** |
| Real PostgreSQL populated migration / collision rollback | **6 passed** |
| Unchanged Phase 1 real PostgreSQL API regressions | **18 passed** |
| Total real PostgreSQL integration | **79 passed**, 4 files |
| Production HTTP checks with real PostgreSQL test sessions | **13 passed** |
| Prisma validate / generate | Passed |
| Typecheck / lint / production build | Passed |
| Whitespace check | Passed |

The full SQL run created a blank owned cluster at
`%TEMP%/ncku-rag-pg-s3x2LE`, applied both migrations, confirmed schema current,
passed all 79 tests, stopped the server, verified it stopped and removed its
directory (exit 0). It did not reuse the development or an existing database.

Only Google's token and JWKS HTTP endpoints are mocked in OAuth integration;
the real JWT verifier, callback state/PKCE, Better Auth handler, Prisma adapter,
database relations and DAL execute. A real session-table read failure is tested
as sanitized 500, with table restoration in `finally`.

The 13 production HTTP checks cover login 200, missing configuration 500,
password 404, invalid public API query 400, anonymous `/admin` 307, Viewer and
inactive 403, Editor/Admin 200, immediate database demotion/deactivation with the
same cookie, successful logout and rejected old cookie. These tests used a
separate fresh cluster and synthetic signed session cookies; both app processes
and the cluster were stopped. Independent code review found no remaining code
blockers after the Unicode whitespace and exception-sanitization fixes.

**Hosted acceptance:** [GitHub Actions run 34071337902](https://github.com/jason310chg-creator/NCKU-RAG/actions/runs/34071337902)
passed for HEAD `ed2cd8231acd22127e40ee2a814895afdbde5ad2` on 2026-09-07.
The job took 1m01s on `ubuntu-24.04`. Clean install, Prisma generation,
163 unit tests / 15 files, 9 runner safety checks, and **79 real Docker PostgreSQL
integration tests / 4 files** passed, followed by typecheck, lint and production
build. Docker PostgreSQL started, both migrations deployed, and schema status
was up to date. This proves the Docker test path on the hosted runner; the local
Windows VM still lacks nested virtualization. It does not prove real Google
consent or production HTTPS browser behavior.

The user's independent review also reproduced unit/safety tests, types, lint,
the original 42-file inventory, package pins and the 19 audit findings. It found
no merge-blocking code issue and requested correction of these remote-status
facts. Non-blocking hardening observations are tracked in [auth operations](auth.md#review-follow-ups).

## 7. Unexecuted acceptance

- **Real Google consent/callback**: no real OAuth client credentials or intended
  Google identity were supplied. This is a required manual pre-deployment check;
  the signed-token fixture tests do not claim it passed. No persistent real Admin
  was provisioned without that identity; the bootstrap CLI was exercised using
  isolated fixtures, including idempotency, concurrency and negative paths.
- **Intended HTTPS host and browser cookie flow**: production HTTP behavior was
  tested locally with explicit test cookies; real TLS/cookie-browser behavior
  still needs the deployment host and Google client.

## 8. Security assumptions

- Allowlist/bootstrap writes and DB administration are trusted operations.
  Google must assert the exact verified email, not merely a Workspace domain.
- Production auth origin is HTTPS and matches the Google redirect URI. All auth
  secrets are external to the repository and client bundle; no fallback exists.
- Database/backup access is restricted. Better Auth encrypts access/refresh
  tokens; ID tokens and session tokens remain credential-bearing database data.
- The linking option and Next experimental `authInterrupts` are version-sensitive;
  keep the exact `better-auth: "1.7.3"` pin and retain the integration/HTTP checks
  for any deliberate dependency upgrade. The pin preserves reviewed behavior;
  closed provisioning and fresh identity checks remain required security gates.
- Existing dependency audit findings remain **19** (15 high, 3 moderate, 1 low),
  unchanged by installation. No forced upgrades were mixed into this phase.

## 9. Regression risk

Public Phase 1 behavior is unchanged and its 18 real SQL regressions pass.
The main rollout risks are intentional inactive defaults, preexisting email
collisions/malformed emails/non-ASCII casing, Google consent/client configuration,
and dependency upgrades affecting identity linking and framework 403 behavior.
The hosted CI/Docker environment has passed as recorded above. These risks are
documented; no migration ran on a persistent
development/production database. See [setup and acceptance steps](auth.md).

## 10. Merge readiness and stopping point

**Phase 2A implementation, local technical acceptance and hosted CI acceptance
are complete. Independent review reports no code merge blocker; PR #2 is ready
to proceed through review.** Check the PR for the current HEAD's checks and formal
GitHub review state; the review supplied in this conversation does not itself
create a GitHub approval. Genuine Google consent/callback and intended HTTPS
browser acceptance remain the two unexecuted manual gates. Keep them open for
the agreed pre-merge/deployment sequence. The branch has been pushed and PR #2
opened; no merge or deployment has occurred, and Phase 2B has not started.
