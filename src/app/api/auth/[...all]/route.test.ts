// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ isAllowedAuthRequest: vi.fn(), getAuth: vi.fn(), handler: vi.fn() }));
vi.mock("../../../../lib/auth/core", () => ({ isAllowedAuthRequest: mocks.isAllowedAuthRequest }));
vi.mock("../../../../lib/auth/server", () => ({ getAuth: mocks.getAuth }));
import { AuthConfigurationError } from "../../../../lib/auth/config";
import { GET, POST } from "./route";

describe("auth route boundary (unit; Better Auth and OAuth tested separately)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.isAllowedAuthRequest.mockReturnValue(true);
    mocks.getAuth.mockReturnValue({ handler: mocks.handler });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([GET, POST])("rejects unavailable auth paths before initializing auth", async (handle) => {
    mocks.isAllowedAuthRequest.mockReturnValue(false);
    const response = await handle(new Request("https://app.example.com/api/auth/sign-in/email"));
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.getAuth).not.toHaveBeenCalled();
  });

  it("preserves OAuth redirects and all cookies while preventing cache storage", async () => {
    const headers = new Headers({ location: "https://accounts.google.com/", "cache-control": "public" });
    headers.append("set-cookie", "one=first; Path=/; HttpOnly");
    headers.append("set-cookie", "two=second; Path=/; HttpOnly");
    mocks.handler.mockResolvedValue(new Response(null, { status: 302, headers }));
    const request = new Request("https://app.example.com/api/auth/callback/google");
    const response = await GET(request);
    expect(mocks.handler).toHaveBeenCalledWith(request);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://accounts.google.com/");
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns explicit configuration failure without credentials", async () => {
    mocks.getAuth.mockImplementation(() => { throw new AuthConfigurationError("GOOGLE_CLIENT_SECRET"); });
    const response = await POST(new Request("https://app.example.com/api/auth/sign-in/social", { method: "POST" }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "AUTH_CONFIGURATION_ERROR", message: "Authentication is not configured" } });
    expect(console.error).toHaveBeenCalledWith("Authentication configuration is missing or invalid");
  });

  it("reports unexpected failures as generic 500 without logging raw errors", async () => {
    mocks.handler.mockRejectedValue(new Error("SQL failed with secret=private-token"));
    const response = await GET(new Request("https://app.example.com/api/auth/get-session"));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toMatch(/SQL|private-token|stack/);
    expect(console.error).toHaveBeenCalledWith("Authentication request failed");
  });
});
