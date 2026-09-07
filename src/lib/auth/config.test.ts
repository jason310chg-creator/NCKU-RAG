import { describe, expect, it } from "vitest";
import { readAuthConfig } from "./config";
import { normalizeEmail } from "./email";

const env = { BETTER_AUTH_URL: "http://localhost:3000", BETTER_AUTH_SECRET: "a".repeat(48), GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-google-secret", NODE_ENV: "test" as const };

describe("auth configuration and exact email identity", () => {
  it("only trims and lowercases email; preserves dots and plus tags", () => {
    expect(normalizeEmail("  First.Last+Tag@Gmail.COM ")).toBe("first.last+tag@gmail.com");
    expect(normalizeEmail("first.last@gmail.com")).not.toBe(normalizeEmail("firstlast@gmail.com"));
  });
  it("requires all auth values without disclosing their contents", () => {
    for (const key of ["BETTER_AUTH_URL", "BETTER_AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]) {
      expect(() => readAuthConfig({ ...env, [key]: "" })).toThrow(key);
    }
    expect(() => readAuthConfig({ ...env, BETTER_AUTH_SECRET: "sensitive-short" })).toThrow("BETTER_AUTH_SECRET");
    expect(() => readAuthConfig({ ...env, BETTER_AUTH_SECRET: "sensitive-short" })).not.toThrow("sensitive-short");
  });
  it("accepts explicit local test and HTTPS production origins", () => {
    expect(readAuthConfig(env)).toMatchObject({ baseURL: env.BETTER_AUTH_URL, googleClientId: env.GOOGLE_CLIENT_ID });
    expect(readAuthConfig({ ...env, BETTER_AUTH_URL: "https://kb.example.edu", NODE_ENV: "production" }).baseURL).toBe("https://kb.example.edu");
  });
  it.each(["https://user:secret@example.edu", "https://example.edu/path", "https://example.edu?secret=value", "https://example.edu#hash", "ftp://example.edu", "http://example.edu", "invalid"]) ("rejects unsafe base URL %s", (url) => {
    expect(() => readAuthConfig({ ...env, BETTER_AUTH_URL: url })).toThrow("BETTER_AUTH_URL");
  });
  it("rejects HTTP even on localhost in production", () => {
    expect(() => readAuthConfig({ ...env, NODE_ENV: "production" })).toThrow("BETTER_AUTH_URL");
  });
});
