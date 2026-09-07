import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { verifyGoogleIdToken, type GoogleProfile } from "better-auth/social-providers";
import type { PrismaClient } from "../../generated/prisma/client";
import type { AuthConfig } from "./config";
import { normalizeEmail } from "./email";

const allowed = new Set([
  "POST /api/auth/sign-in/social", "POST /api/auth/sign-out",
  "GET /api/auth/get-session", "GET /api/auth/callback/google",
]);

/** An allowlist also blocks parameterized password/self-management endpoints. */
export function isAllowedAuthRequest(request: Request): boolean {
  return allowed.has(`${request.method} ${new URL(request.url).pathname}`);
}

export function authFailure(status: number): Response {
  return Response.json({ error: {
    code: status >= 500 ? "INTERNAL_ERROR" : status === 404 ? "NOT_FOUND" : "AUTHENTICATION_FAILED",
    message: status >= 500 ? "Authentication service unavailable" : status === 404 ? "Not found" : "Authentication failed",
  } }, { status, headers: { "cache-control": "no-store" } });
}

/** The only entry point to the real Better Auth instance; no password API escapes. */
export function createAuth(prisma: PrismaClient, config: AuthConfig) {
  // Better Auth converts some adapter exceptions to redirects/null. Track the
  // actual database boundary per request so outages remain 500, never 401/403.
  const requests = new AsyncLocalStorage<{ databaseFailed: boolean }>();
  const database = prisma.$extends({ query: { $allOperations: async ({ args, query }) => {
    try { return await query(args); }
    catch (error) {
      const state = requests.getStore();
      if (state) state.databaseFailed = true;
      throw error;
    }
  } } });
  const raw = betterAuth({
    appName: "NCKU RAG",
    baseURL: config.baseURL,
    secret: config.secret,
    trustedOrigins: [config.baseURL],
    database: prismaAdapter(database, { provider: "postgresql", transaction: true }),
    advanced: { database: { generateId: "uuid" } },
    emailAndPassword: { enabled: false },
    socialProviders: { google: {
      clientId: config.googleClientId,
      clientSecret: config.googleClientSecret,
      // Always let operators recover from choosing an unlisted Google account.
      // Otherwise Google can silently reuse it and bounce back to the same error.
      prompt: "select_account",
      disableSignUp: true,
      disableImplicitSignUp: true,
      // Verify the fresh claim below. The provider's built-in option reads a
      // stale pre-link User in 1.7.3 and rejects a newly verified allowlist row.
      getUserInfo: async (tokens) => {
        if (!tokens.idToken) return null;
        const claims = await verifyGoogleIdToken({
          token: tokens.idToken, audience: config.googleClientId,
        });
        if (!claims || claims.email_verified !== true || typeof claims.email !== "string" ||
            typeof claims.sub !== "string" || !claims.sub) return null;
        const email = normalizeEmail(claims.email);
        const user = await database.user.findUnique({ where: { email } });
        if (!user?.isActive) return null;
        return { user: {
          name: user.name, email, emailVerified: true,
          allowlistUserId: user.id,
        }, data: claims as unknown as GoogleProfile };
      },
    } },
    user: {
      changeEmail: { enabled: false }, deleteUser: { enabled: false },
      validateUserInfo: ({ user, source }) => {
        // This runs for BOTH first linking and returning provider sign-ins.
        // Use only the fresh verified mapping; database role is never mapped.
        if (source.method !== "oauth" || source.oauth?.providerId !== "google" ||
            source.action === "create-user" || user.emailVerified !== true ||
            user.allowlistUserId !== user.id) return { error: "authentication_failed" };
      },
    },
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true, disableImplicitLinking: false,
        // Required for pre-created UUID allowlist records. Closed provisioning
        // and fresh verified Google email checks above are mandatory partners.
        requireLocalEmailVerified: false,
        allowDifferentEmails: false, updateUserInfoOnLink: false,
      },
    },
    session: { cookieCache: { enabled: false } },
    databaseHooks: {
      user: { create: { before: async () => {
        throw new APIError("FORBIDDEN", { message: "Authentication failed" });
      } } },
      session: { create: { before: async (session) => {
        const user = await database.user.findUnique({ where: { id: session.userId } });
        if (!user?.isActive || !user.emailVerified) {
          throw new APIError("FORBIDDEN", { message: "Authentication failed" });
        }
      } } },
    },
    onAPIError: { errorURL: `${config.baseURL}/login` },
    // Library diagnostics may contain adapter SQL or provider tokens. Keep
    // operational signals, but never forward their unstructured arguments.
    logger: { level: "error", log: () => { console.error("Authentication library error"); } },
  });

  return {
    handler: async (request: Request): Promise<Response> => {
      if (!isAllowedAuthRequest(request)) return authFailure(404);
      if (request.method === "POST" && request.headers.get("origin") !== config.baseURL) return authFailure(403);
      if (new URL(request.url).pathname === "/api/auth/sign-in/social") {
        let body: Record<string, unknown>;
        try { body = await request.clone().json(); }
        catch { return authFailure(400); }
        // Keep the state/PKCE browser flow as the sole login mechanism.
        if (!body || body.provider !== "google" || body.idToken !== undefined) return authFailure(400);
      }
      return requests.run({ databaseFailed: false }, async () => {
        try {
          const response = await raw.handler(request);
          if (requests.getStore()?.databaseFailed) return authFailure(500);
          if (response.status >= 400) return authFailure(response.status);
          const result = new Response(response.body, response);
          result.headers.set("cache-control", "no-store");
          const location = result.headers.get("location");
          if (location && new URL(location, config.baseURL).searchParams.has("error")) {
            result.headers.set("location", `${config.baseURL}/login?error=authentication_failed`);
          }
          return result;
        } catch {
          console.error("Authentication request failed");
          return authFailure(500);
        }
      });
    },
    api: {
      getSession: async (options: { headers: Headers; query?: { disableCookieCache?: boolean; disableRefresh?: boolean } }) => {
        return requests.run({ databaseFailed: false }, async () => {
          try {
            const session = await raw.api.getSession({ ...options, query: {
              ...options.query, disableCookieCache: true, disableRefresh: true,
            } });
            if (requests.getStore()?.databaseFailed) throw new Error("Authentication database unavailable");
            return session;
          } catch {
            // Server Components can log thrown errors. Do not let adapter SQL,
            // connection details or library exception arguments reach that log.
            throw new Error("Authentication service unavailable");
          }
        });
      },
    },
  };
}
