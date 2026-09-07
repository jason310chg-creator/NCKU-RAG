import { randomBytes, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { exportJWK, generateKeyPair, SignJWT, type JWTPayload } from "jose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient, Role } from "../../src/generated/prisma/client";
import { createAuth } from "../../src/lib/auth/core";
import { createAuthDal } from "../../src/lib/auth/dal-core";

// The runner owns this disposable database. Never use a developer's .env URL.
const testUrl = "postgresql://kb_test@127.0.0.1:55433/kb_platform_test?schema=public";
if (process.env.TEST_DATABASE_URL !== testUrl || process.env.DATABASE_URL !== testUrl) {
  throw new Error("Use npm run test:integration with the isolated test database");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl, connectionTimeoutMillis: 3000 }) });
const baseURL = "http://localhost:3000";
const clientId = "integration-only.apps.googleusercontent.com";
const clientSecret = "integration-only-google-client-secret";
const googleSubject = "integration-google-subject";
const editorEmail = "allowed.editor+tag@auth.example";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let auth: ReturnType<typeof createAuth>;
let keys: Awaited<ReturnType<typeof generateKeyPair>>;
let publicJwk: Awaited<ReturnType<typeof exportJWK>>;
const codeTokens = new Map<string, string>();
let tokenExchangeCount = 0;
let certificateRequestCount = 0;

function cookies(response: Response) {
  return response.headers.getSetCookie().map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

async function signedToken(claims: JWTPayload = {}, key = keys.privateKey) {
  return new SignJWT({
    sub: googleSubject,
    email: editorEmail,
    email_verified: true,
    name: "Verified Google Editor",
    picture: "https://example.com/avatar.png",
    ...claims,
  })
    .setProtectedHeader({ alg: "RS256", kid: "integration-google-key" })
    .setIssuedAt()
    .setIssuer("https://accounts.google.com")
    .setAudience(clientId)
    .setExpirationTime("5m")
    .sign(key);
}

async function post(path: string, body: unknown, cookie?: string) {
  return auth.handler(new Request(`${baseURL}/api/auth${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: baseURL, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  }));
}

async function beginSignIn(extra: Record<string, unknown> = {}) {
  const response = await post("/sign-in/social", {
    provider: "google", callbackURL: `${baseURL}/admin`,
    errorCallbackURL: `${baseURL}/login`, disableRedirect: true, ...extra,
  });
  expect(response.status).toBe(200);
  const payload = await response.json();
  const authorization = new URL(payload.url);
  expect(authorization.origin).toBe("https://accounts.google.com");
  expect(authorization.searchParams.get("prompt")).toBe("select_account");
  expect(authorization.searchParams.get("redirect_uri")).toBe(`${baseURL}/api/auth/callback/google`);
  expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
  const state = authorization.searchParams.get("state");
  expect(state).toBeTruthy();
  return { state: state!, cookie: cookies(response) };
}

async function callback(token: string, extra: Record<string, unknown> = {}) {
  const pending = await beginSignIn(extra);
  const code = randomUUID();
  codeTokens.set(code, token);
  return auth.handler(new Request(`${baseURL}/api/auth/callback/google?${new URLSearchParams({ code, state: pending.state })}`, {
    headers: { cookie: pending.cookie },
  }));
}

async function getSession(cookie: string) {
  const response = await auth.handler(new Request(`${baseURL}/api/auth/get-session`, { headers: { cookie } }));
  expect(response.status).toBe(200);
  return response.json();
}

function dal() {
  return createAuthDal(prisma, (headers) => auth.api.getSession({ headers, query: { disableCookieCache: true } }));
}

async function allowUser(role: Role = Role.editor, extra: { email?: string; isActive?: boolean } = {}) {
  return prisma.user.create({ data: {
    id: randomUUID(), name: "Precreated User", email: editorEmail,
    role, emailVerified: false, isActive: true, ...extra,
  } });
}

async function expectLoginRejected(response: Response) {
  const location = response.headers.get("location");
  if (location) {
    expect(response.status).toBe(302);
    expect(new URL(location).pathname).toBe("/login");
    expect(new URL(location).searchParams.has("error")).toBe(true);
  } else {
    expect([400, 401, 403]).toContain(response.status);
  }
  expect(await prisma.session.count()).toBe(0);
  expect(response.headers.getSetCookie().some((cookie) => /session_token=[^;]/.test(cookie))).toBe(false);
  const text = `${location ?? ""} ${await response.text()}`;
  expect(text).not.toContain(clientSecret);
  expect(text).not.toContain("PrismaClient");
}

describe("real PostgreSQL Better Auth Google OAuth", () => {
  beforeAll(async () => {
    await prisma.$connect();
    if (process.env.TEST_DATABASE_MODE === "native") {
      const expectedDirectory = process.env.TEST_DATABASE_DIR;
      if (!expectedDirectory) throw new Error("Native tests require their owned cluster directory");
      const [identity] = await prisma.$queryRaw<Array<{
        directory: string; username: string; database: string; version: string;
      }>>`SELECT current_setting('data_directory') AS directory,
        current_user AS username, current_database() AS database,
        current_setting('server_version_num') AS version`;
      const canonical = (path: string) => {
        const value = realpathSync(path);
        return process.platform === "win32" ? value.toLowerCase() : value;
      };
      if (!identity || canonical(identity.directory) !== canonical(expectedDirectory) ||
          identity.username !== "kb_test" || identity.database !== "kb_platform_test" ||
          !/^17\d{4}$/.test(identity.version)) {
        throw new Error("Refusing auth fixtures: database is not the owned PostgreSQL 17 cluster");
      }
    }
    keys = await generateKeyPair("RS256", { extractable: true });
    publicJwk = await exportJWK(keys.publicKey);
  });

  beforeEach(async () => {
    // Auth fixtures have no documents; delete only their dependent auth records.
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.verification.deleteMany();
    await prisma.user.deleteMany();
    codeTokens.clear();
    tokenExchangeCount = 0;
    certificateRequestCount = 0;
    // Only Google's external HTTP boundary is replaced. Better Auth's handler,
    // state/PKCE, provider JWT verifier, adapter, hooks and PostgreSQL stay real.
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      if (request.url === "https://www.googleapis.com/oauth2/v3/certs") {
        certificateRequestCount += 1;
        return Response.json({ keys: [{ ...publicJwk, kid: "integration-google-key", alg: "RS256", use: "sig" }] });
      }
      if (request.url === "https://oauth2.googleapis.com/token") {
        tokenExchangeCount += 1;
        expect(request.method).toBe("POST");
        const body = new URLSearchParams(await request.text());
        expect(body.get("grant_type")).toBe("authorization_code");
        expect(body.get("redirect_uri")).toBe(`${baseURL}/api/auth/callback/google`);
        expect(body.get("code_verifier")).toBeTruthy();
        const token = codeTokens.get(body.get("code") ?? "");
        if (!token) return Response.json({ error: "invalid_grant" }, { status: 400 });
        codeTokens.delete(body.get("code")!);
        return Response.json({ access_token: "integration-only-access-token", token_type: "Bearer", expires_in: 3600, id_token: token });
      }
      throw new Error(`Unexpected outbound HTTP in auth integration test: ${new URL(request.url).origin}`);
    }));
    auth = createAuth(prisma, { baseURL, secret: randomBytes(48).toString("base64url"), googleClientId: clientId, googleClientSecret: clientSecret });
  });

  afterEach(() => { vi.unstubAllGlobals(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it("links a pre-created UUID Editor through the genuine callback and persists its database session", async () => {
    const existing = await allowUser();
    const response = await callback(await signedToken());
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(`${baseURL}/admin`);
    expect(tokenExchangeCount).toBe(1);
    expect(certificateRequestCount).toBeGreaterThan(0);
    const users = await prisma.user.findMany();
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ id: existing.id, email: editorEmail, role: Role.editor, emailVerified: true, isActive: true });
    const account = await prisma.account.findFirstOrThrow();
    expect(account).toMatchObject({ userId: existing.id, providerId: "google", accountId: googleSubject });
    expect(account.id).toMatch(uuidPattern);
    const session = await prisma.session.findFirstOrThrow();
    expect(session.userId).toBe(existing.id);
    expect(session.id).toMatch(uuidPattern);
    const authenticated = await getSession(cookies(response));
    expect(authenticated.user.id).toBe(existing.id);
    expect(authenticated.session.id).toBe(session.id);
    expect(await prisma.verification.count()).toBe(0);
  });

  it("allows a pre-created active Admin without creating or elevating another account", async () => {
    const existing = await allowUser(Role.admin);
    const response = await callback(await signedToken());
    expect(response.headers.get("location")).toBe(`${baseURL}/admin`);
    expect((await getSession(cookies(response))).user.id).toBe(existing.id);
    expect(await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).toMatchObject({ role: Role.admin });
    expect(await prisma.user.count()).toBe(1);
  });

  it("ignores caller and provider role fields and keeps the database Editor role", async () => {
    const existing = await allowUser();
    const response = await callback(await signedToken({ role: "admin", isActive: true }), {
      role: "admin", additionalData: { role: "admin", userId: randomUUID(), isActive: true },
    });
    expect(response.headers.get("location")).toBe(`${baseURL}/admin`);
    const headers = new Headers({ cookie: cookies(response) });
    await expect(dal().requireAdmin(headers)).rejects.toMatchObject({ status: 403 });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).toMatchObject({ role: Role.editor });
  });

  it("normalizes only trim and lowercase before matching a verified email", async () => {
    const existing = await allowUser();
    const response = await callback(await signedToken({ email: `  ${editorEmail.toUpperCase()}  ` }));
    expect(response.headers.get("location")).toBe(`${baseURL}/admin`);
    expect((await getSession(cookies(response))).user.id).toBe(existing.id);
  });

  it.each([
    "unknown@auth.example", "allowed.editor@auth.example", "allowededitor+tag@auth.example",
  ])("rejects non-allowlisted exact email %s without creating a user", async (email) => {
    await allowUser();
    await expectLoginRejected(await callback(await signedToken({ email })));
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.account.count()).toBe(0);
  });

  it.each([false, "true", undefined])("rejects Google email_verified=%s on first login", async (verified) => {
    await allowUser();
    await expectLoginRejected(await callback(await signedToken({ email_verified: verified })));
    expect(await prisma.account.count()).toBe(0);
  });

  it("rejects an inactive allowlisted user", async () => {
    await allowUser(Role.editor, { isActive: false });
    await expectLoginRejected(await callback(await signedToken()));
    expect(await prisma.account.count()).toBe(0);
  });

  it("rejects an unverified fresh Google claim even when the existing linked User is already verified", async () => {
    const existing = await allowUser();
    expect((await callback(await signedToken())).status).toBe(302);
    await prisma.session.deleteMany();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).emailVerified).toBe(true);
    await expectLoginRejected(await callback(await signedToken({ email_verified: false })));
    expect(await prisma.account.count()).toBe(1);
  });

  it("rejects a linked Google subject whose email now belongs to a different allowlisted UUID", async () => {
    const original = await allowUser();
    expect((await callback(await signedToken())).headers.get("location")).toBe(`${baseURL}/admin`);
    await prisma.session.deleteMany();
    const other = await allowUser(Role.admin, { email: "other.admin@auth.example" });
    await expectLoginRejected(await callback(await signedToken({ email: other.email })));
    expect(await prisma.account.findFirstOrThrow()).toMatchObject({ userId: original.id, accountId: googleSubject });
  });

  it("denies callback signup even when the client explicitly requests it", async () => {
    await expectLoginRejected(await callback(await signedToken(), { requestSignUp: true }));
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.account.count()).toBe(0);
  });

  it("denies direct ID-token signup even when the client explicitly requests it", async () => {
    const response = await post("/sign-in/social", {
      provider: "google", requestSignUp: true, idToken: { token: await signedToken() },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });

  it("keeps browser state and PKCE mandatory even for a valid allowlisted direct ID token", async () => {
    await allowUser();
    const response = await post("/sign-in/social", {
      provider: "google", idToken: { token: await signedToken() },
    });
    expect(response.status).toBe(400);
    expect(certificateRequestCount).toBe(0);
    expect(await prisma.account.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });

  it.each([undefined, "https://attacker.example"])("rejects login mutation Origin %s before starting OAuth", async (origin) => {
    const response = await auth.handler(new Request(`${baseURL}/api/auth/sign-in/social`, {
      method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: JSON.stringify({ provider: "google", callbackURL: `${baseURL}/admin` }),
    }));
    expect(response.status).toBe(403);
    expect(await prisma.verification.count()).toBe(0);
    expect(tokenExchangeCount).toBe(0);
  });

  it("rejects a token with an invalid signature at the real Google verifier", async () => {
    await allowUser();
    const attackerKeys = await generateKeyPair("RS256");
    await expectLoginRejected(await callback(await signedToken({}, attackerKeys.privateKey)));
    expect(certificateRequestCount).toBeGreaterThan(0);
    expect(await prisma.account.count()).toBe(0);
  });

  it.each(["issuer", "audience", "expiration"] as const)("rejects an invalid token %s", async (invalidClaim) => {
    await allowUser();
    const token = await new SignJWT({ sub: googleSubject, email: editorEmail, email_verified: true, name: "Editor" })
      .setProtectedHeader({ alg: "RS256", kid: "integration-google-key" })
      .setIssuedAt()
      .setIssuer(invalidClaim === "issuer" ? "https://attacker.example" : "https://accounts.google.com")
      .setAudience(invalidClaim === "audience" ? "another-app" : clientId)
      .setExpirationTime(invalidClaim === "expiration" ? Math.floor(Date.now() / 1000) - 60 : "5m")
      .sign(keys.privateKey);
    await expectLoginRejected(await callback(token));
    expect(await prisma.account.count()).toBe(0);
  });

  it("requires matching state cookie before exchanging a Google authorization code", async () => {
    await allowUser();
    const pending = await beginSignIn();
    const response = await auth.handler(new Request(`${baseURL}/api/auth/callback/google?code=untrusted&state=${pending.state}`));
    await expectLoginRejected(response);
    expect(tokenExchangeCount).toBe(0);
  });

  it("cannot replay an already consumed OAuth callback", async () => {
    await allowUser();
    const pending = await beginSignIn();
    const code = randomUUID();
    codeTokens.set(code, await signedToken());
    const request = () => new Request(`${baseURL}/api/auth/callback/google?code=${code}&state=${pending.state}`, { headers: { cookie: pending.cookie } });
    expect((await auth.handler(request())).headers.get("location")).toBe(`${baseURL}/admin`);
    await prisma.session.deleteMany();
    await expectLoginRejected(await auth.handler(request()));
    expect(tokenExchangeCount).toBe(1);
  });

  it("removes the database session on logout and rejects the old signed cookie", async () => {
    await allowUser();
    const cookie = cookies(await callback(await signedToken()));
    expect(await prisma.session.count()).toBe(1);
    expect((await post("/sign-out", {}, cookie)).status).toBe(200);
    expect(await prisma.session.count()).toBe(0);
    expect(await getSession(cookie)).toBeNull();
  });

  it("rejects a revoked session rather than accepting its previously valid signed cookie", async () => {
    await allowUser();
    const cookie = cookies(await callback(await signedToken()));
    await prisma.session.deleteMany();
    expect(await getSession(cookie)).toBeNull();
  });

  it("rejects an expired database session", async () => {
    await allowUser();
    const cookie = cookies(await callback(await signedToken()));
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 60_000) } });
    expect(await getSession(cookie)).toBeNull();
  });

  it("returns 401 from the protected DAL without a session", async () => {
    await expect(dal().requireEditor(new Headers())).rejects.toMatchObject({ status: 401 });
  });

  it("allows a Viewer to authenticate but denies entry to Admin", async () => {
    await allowUser(Role.viewer);
    const headers = new Headers({ cookie: cookies(await callback(await signedToken())) });
    expect((await dal().requireUser(headers)).role).toBe(Role.viewer);
    await expect(dal().requireEditor(headers)).rejects.toMatchObject({ status: 403 });
  });

  it("allows Editor entry but returns 403 from requireAdmin", async () => {
    await allowUser(Role.editor);
    const headers = new Headers({ cookie: cookies(await callback(await signedToken())) });
    expect((await dal().requireEditor(headers)).role).toBe(Role.editor);
    await expect(dal().requireAdmin(headers)).rejects.toMatchObject({ status: 403 });
  });

  it("allows an active Admin through requireAdmin", async () => {
    const existing = await allowUser(Role.admin);
    const headers = new Headers({ cookie: cookies(await callback(await signedToken())) });
    expect(await dal().requireAdmin(headers)).toMatchObject({ id: existing.id, role: Role.admin });
  });

  it("applies role demotion on the next protected request using the same session cookie", async () => {
    const existing = await allowUser(Role.admin);
    const headers = new Headers({ cookie: cookies(await callback(await signedToken())) });
    const access = dal();
    expect((await access.requireAdmin(headers)).role).toBe(Role.admin);
    await prisma.user.update({ where: { id: existing.id }, data: { role: Role.editor } });
    await expect(access.requireAdmin(headers)).rejects.toMatchObject({ status: 403 });
    expect((await access.requireEditor(headers)).role).toBe(Role.editor);
    await prisma.user.update({ where: { id: existing.id }, data: { role: Role.viewer } });
    await expect(access.requireEditor(headers)).rejects.toMatchObject({ status: 403 });
    expect(await prisma.session.count()).toBe(1);
  });

  it("applies deactivation on the next protected request despite an unexpired database session", async () => {
    const existing = await allowUser(Role.admin);
    const headers = new Headers({ cookie: cookies(await callback(await signedToken())) });
    expect((await dal().requireAdmin(headers)).id).toBe(existing.id);
    await prisma.user.update({ where: { id: existing.id }, data: { isActive: false } });
    await expect(dal().requireEditor(headers)).rejects.toMatchObject({ status: 403 });
    expect(await prisma.session.count()).toBe(1);
  });

  it("refuses a new session for a previously linked user who was deactivated", async () => {
    const existing = await allowUser();
    expect((await callback(await signedToken())).headers.get("location")).toBe(`${baseURL}/admin`);
    await prisma.session.deleteMany();
    await prisma.user.update({ where: { id: existing.id }, data: { isActive: false } });
    await expectLoginRejected(await callback(await signedToken()));
  });

  it.each([
    "/sign-in/email", "/sign-up/email", "/request-password-reset", "/reset-password",
    "/reset-password/arbitrary-token", "/change-password", "/set-password", "/verify-password",
    "/update-user", "/change-email", "/delete-user", "/link-social", "/unlink-account",
  ])("does not expose password or self-management endpoint %s", async (path) => {
    const response = await post(path, {
      email: editorEmail, password: "integration-only-password", name: "Untrusted", role: "admin",
    });
    expect(response.status).toBe(404);
    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });

  it("enforces unique Google identity and UUID foreign keys in PostgreSQL", async () => {
    const existing = await allowUser();
    expect((await callback(await signedToken())).headers.get("location")).toBe(`${baseURL}/admin`);
    const account = await prisma.account.findFirstOrThrow();
    await expect(prisma.account.create({ data: {
      id: randomUUID(), providerId: account.providerId, accountId: account.accountId, userId: existing.id,
    } })).rejects.toMatchObject({ code: "P2002" });
    await expect(prisma.session.create({ data: {
      id: randomUUID(), userId: randomUUID(), token: randomUUID(), expiresAt: new Date(Date.now() + 60_000),
    } })).rejects.toMatchObject({ code: "P2003" });
    await prisma.user.delete({ where: { id: existing.id } });
    expect(await prisma.account.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });

  it("reports a real PostgreSQL session-read failure as a sanitized 500, never an anonymous session", async () => {
    await allowUser();
    const cookie = cookies(await callback(await signedToken()));
    expect(await getSession(cookie)).not.toBeNull();
    // This suite runs serially in the runner-owned disposable database. Rename
    // only this table to force a genuine adapter error, then restore even if
    // an assertion fails; no process outage or developer database is involved.
    await prisma.$executeRaw`ALTER TABLE "sessions" RENAME TO "sessions_auth_failure_test"`;
    try {
      const response = await auth.handler(new Request(`${baseURL}/api/auth/get-session`, { headers: { cookie } }));
      expect(response.status).toBe(500);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({ error: {
        code: "INTERNAL_ERROR", message: "Authentication service unavailable",
      } });
      await expect(auth.api.getSession({ headers: new Headers({ cookie }) })).rejects.toThrow();
    } finally {
      await prisma.$executeRaw`ALTER TABLE "sessions_auth_failure_test" RENAME TO "sessions"`;
    }
    expect(await getSession(cookie)).not.toBeNull();
  });
});
