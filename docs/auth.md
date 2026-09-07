# Phase 2A authentication operations

Only Google OAuth is exposed. `/login` starts the state/PKCE authorization-code
flow; Google returns to `/api/auth/callback/google`. `/admin` requires an active
Editor or Admin, checked on the server. Logout deletes the database session.
User/document management remains Phase 2B; this phase has no management writes.

## Configuration and first Admin

1. Run `npm.cmd ci` and `npm.cmd run db:generate`.
2. Copy `.env.example` to local `.env` and set `DATABASE_URL` for the intended
   development database. The disposable integration database is never used for
   a persistent Admin or real Google credentials.
3. Apply checked-in migrations with `npm.cmd exec prisma migrate deploy` and
   inspect `npm.cmd exec prisma migrate status`. Back up an existing installation
   before applying its database migration.
4. Set `BETTER_AUTH_URL` to the exact origin, without a path/query/fragment.
   Production requires HTTPS. Local development can use `http://localhost:3000`.
5. Set a cryptographically random `BETTER_AUTH_SECRET` of at least 32 characters,
   plus real `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. One local generation
   command is `node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('base64url'))"`.
   Store the result only in the local secret configuration. No `NEXT_PUBLIC_`
   secret, default secret, password or fallback account is supported.
6. Configure a Google Web OAuth client with the authorized redirect URI
   `<BETTER_AUTH_URL>/api/auth/callback/google` and corresponding authorized origin.
   Configure consent-screen access/test users in Google separately.
7. Provision the first Admin explicitly:

   ```powershell
   npm.cmd run bootstrap:admin -- --email 'your-exact-google-email' --name 'Your Name'
   ```

   Replace both arguments with the intended real identity. The example is not a
   preconfigured account. Email is normalized with trim/lowercase only; plus tags
   and Gmail dots remain significant. No password or Google tokens are created.
8. Run `npm.cmd run dev`, then visit `/login` and use Google to sign in.

The script is first-Admin provisioning, not a general role-management tool.
Repeated calls for the same active Admin preserve its UUID and name. A requested
existing non-Admin may become the first Admin only when no Admin exists; another
existing Admin, including an inactive Admin, stops provisioning. An inactive
Admin is not silently reactivated. A database transaction advisory lock makes
concurrent bootstrap calls obey the same rule. Missing/invalid arguments or
configuration exit nonzero, with no connection string, SQL or stack in CLI output.

## Identity and database guarantees

- Better Auth is pinned to **1.7.3**, with the PostgreSQL Prisma adapter and UUID
  generation. Existing `User.id`, `Role`, document ownership and content stay intact.
- Migration `20260907000000_phase2a_auth` adds User verification/image/active
  fields and UUID Account/Session/Verification tables. Account provider+subject
  and session token are unique; Account/Session User FKs cascade; identifiers,
  User FKs and expirations have explicit indexes. Account's nullable password
  column is adapter compatibility only; no password endpoint is reachable.
- Existing emails are normalized, never merged. A canonical-email collision
  aborts the whole migration. Resolve competing identities explicitly before
  retrying. Malformed legacy emails also abort and roll back the migration: the
  canonical check rejects internal whitespace and values without exactly one
  `@` separating nonempty local/domain parts. Resolve those records explicitly.
  New and migrated users default to inactive, preventing historical
  content owners from becoming an implicit login allowlist. Existing inactive
  Admins require an explicit operator decision; bootstrap does not override them.
  The SQL migration explicitly matches JavaScript's trim whitespace set.
  PostgreSQL and JavaScript can differ in non-ASCII lowercasing under some database
  locales; installations with legacy internationalized email identities need an
  explicit canonical-identity check before applying this migration.
- The Google ID token is verified against Google's signing keys, issuer,
  audience, expiration and maximum age. Every login requires the **fresh**
  `email_verified: true` claim and an exact active database email match. The
  linked Google subject must resolve to that same precreated UUID, including
  returning logins. No email suffix rule, automatic registration or role mapping.
- Implicit linking to an initially unverified local row is explicitly enabled
  through `requireLocalEmailVerified: false`. This is safe only together with
  closed provisioning and the fresh verified-email/UUID gates. In 1.7.3 the
  provider's `requireEmailVerification` option reads a stale local User after
  first linking; verification is instead enforced by our claim validation and
  fresh database session-create hook. The real callback integration test proves
  this configuration preserves the UUID and creates the correct relations.
- Database sessions use signed HTTP-only cookies; cookie-session caching is
  disabled. The DAL obtains a verified session and rereads the User's role and
  active state on every protected call, so demotion/deactivation takes effect on
  the next request. OAuth claims, client fields and session role snapshots do
  not authorize a request. HTTPS enables Better Auth's secure cookies.
  The pinned library currently supplies the session defaults: seven-day expiry
  and one-day update age. Server DAL/session-wrapper reads force
  `disableRefresh: true`, so activity limited to those reads does not extend a
  session. The exposed HTTP `GET /api/auth/get-session` reaches the raw library
  handler and can refresh an eligible session; this is not a guaranteed absolute
  seven-day lifetime. Explicit expiry/refresh policy remains a review follow-up.
- Better Auth encrypts stored OAuth access/refresh tokens using the auth secret.
  Its adapter also stores the ID token and database session token; restrict DB
  access and backups as credential-bearing data. No tokens are placed in client
  storage or application logs. Changing the auth secret invalidates cookies and
  affects decryption of stored OAuth tokens; plan rotation explicitly.
- Only four exact method/path pairs are exposed. Password, registration,
  self-update, account linking/unlinking and deletion endpoints return 404.
  POST requests require the configured Origin, with Better Auth's own origin,
  state and PKCE checks also active. Direct client ID-token login is disabled.
- Library database failures are tracked per request, including exceptions the
  library normally converts to redirects/null. Auth returns generic 500 on
  database failure; callers never receive SQL, stack, secret or raw provider
  errors. Operational logs use static error messages. Auth configuration is lazy
  and missing settings fail at request time; builds need no fabricated secrets.
- `/admin` uses Next 16's `forbidden()` for a real 403 and redirects anonymous
  requests to `/login`. This requires experimental `authInterrupts`, enabled
  explicitly in Next config. Reverify its HTTP behavior when upgrading Next.

Implementation reference: pinned [OAuth linking source](https://github.com/better-auth/better-auth/blob/v1.7.3/packages/better-auth/src/oauth2/link-account.ts)
and [Google provider/verifier source](https://github.com/better-auth/better-auth/blob/v1.7.3/packages/core/src/social-providers/google.ts).
Do not upgrade Better Auth or replace these gates without rerunning UUID and
returning-user integration coverage; live documentation may describe newer APIs.

## Verification and deployment gate

Run the quality commands in README. `test:integration -- --native` creates a
fresh PostgreSQL 17 cluster, applies both migrations, and exercises the real
Better Auth handler, Prisma adapter, session and DAL. Only Google's token/JWKS
HTTP boundary is substituted with signed test tokens; no real Google account
or credential is needed. Migration tests also upgrade populated Phase 1 schemas
and prove rollback on email collisions. Bootstrap tests cover idempotency and
concurrent provisioning. Existing anonymous Phase 1 regressions run unchanged.

GitHub Actions uses clean `npm ci`, explicit Prisma generation, unit tests,
Docker PostgreSQL integration, typecheck, lint and build. It requires no OAuth
secrets. A local native PostgreSQL pass does not certify the Docker or hosted
GitHub Actions environment on its own. The subsequent authorized
[hosted run 34071337902](https://github.com/jason310chg-creator/NCKU-RAG/actions/runs/34071337902)
passed for `ed2cd8231acd22127e40ee2a814895afdbde5ad2` on `ubuntu-24.04`, including
Docker startup, migrations, 79 SQL integration tests, types, lint and build.
The Docker test path is therefore verified on that runner, while this Windows
VM still lacks the virtualization needed for local Docker.

**Manual acceptance status:** real allowed Admin and Editor accounts completed
the local `http://localhost:3000` Google consent/callback flow. Each callback
reached `/admin`, reload preserved access, logout removed the database Session,
and the existing UUID, verified email and Google Account relation were confirmed.
With the Editor's Session preserved, changing its database role to Viewer caused
the next `/admin` request to return 403; restoring Editor restored access, and
setting the account inactive caused the next request to return 403 again. The
account was restored to active Editor before logout. No credential or
authorization-code value is included in committed files or PR content. This does
not verify HTTPS cookie behavior or production-origin callback configuration.
Before deployment, reject a real unlisted Google account and confirm callback
origin and secure cookies on the intended HTTPS host. Phase 2B needs separate
authorization after 2A review. The Phase 2A branch was pushed and PR #2 opened
with authorization; no merge, deployment or repository settings change has
occurred. Keep the remaining manual checks open for the agreed pre-merge/
deployment sequence.

## Review follow-ups

The independent Phase 2A review reported no merge-blocking code finding. This
documentation update records these hardening opportunities; it does not claim
the corresponding runtime changes have been implemented:

- **Diagnostics:** logs currently contain only static error text. Add a request
  ID and a bounded, allowlisted error name/code classification to distinguish
  failure categories without logging messages, arbitrary arguments, tokens,
  secrets or authorization codes. Verify which provider failures the library
  actually exposes before promising a diagnostic category.
- **Session policy:** choose and explicitly configure expiry/update age and
  whether renewal is permitted on each read path. Preserve fresh role/active
  checks independently of renewal. Current behavior is described above.
- **Prisma errors:** the request failure flag currently catches every Prisma
  exception. Assess known constraint errors the library can safely recover from
  while preserving 500 for unexpected failures. A concurrent callback/P2002
  turning into a spurious 500 is a review hypothesis, not a reproduced test.
- **Error response headers:** replacing library responses at status >=400 drops
  their headers, including any cookie clearing and rate-limit delay. HTTP 429 is
  retained numerically but uses the generic authentication error code. Pinned
  Better Auth emits `X-Retry-After`; preserve intentional safe headers and define
  standard `Retry-After` behavior when improving this boundary.
- **Rate limiting:** the production library default is an in-memory, per-process
  limiter, not a shared multi-instance limit. Plan explicit policy and shared
  enforcement for the intended public deployment topology.

Migration malformed-email handling and per-page DAL requirements are now
documented here and in `AGENTS.md`. Keep the exact Better Auth 1.7.3 pin; its
reviewed behavior must be retested before any upgrade.
