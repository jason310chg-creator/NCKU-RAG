export interface AuthConfig {
  baseURL: string;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
}

export class AuthConfigurationError extends Error {
  constructor(key: string) {
    super(`Missing or invalid ${key}`);
    this.name = "AuthConfigurationError";
  }
}

/** Called at auth request time, never at import/build time. No defaults. */
export function readAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const required = (key: string) => {
    const value = env[key];
    if (!value || !value.trim()) throw new AuthConfigurationError(key);
    return value;
  };
  const baseURL = required("BETTER_AUTH_URL");
  let url: URL;
  try { url = new URL(baseURL); }
  catch { throw new AuthConfigurationError("BETTER_AUTH_URL"); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && local && env.NODE_ENV !== "production"))) {
    throw new AuthConfigurationError("BETTER_AUTH_URL");
  }
  const secret = required("BETTER_AUTH_SECRET");
  if (secret.length < 32) throw new AuthConfigurationError("BETTER_AUTH_SECRET");
  return { baseURL: url.origin, secret, googleClientId: required("GOOGLE_CLIENT_ID"), googleClientSecret: required("GOOGLE_CLIENT_SECRET") };
}
