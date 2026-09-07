// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ headers: vi.fn(), getSession: vi.fn(), findUnique: vi.fn(), getPrisma: vi.fn() }));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("./server", () => ({ getAuth: () => ({ api: { getSession: mocks.getSession } }) }));
vi.mock("../prisma", () => ({ getPrisma: mocks.getPrisma }));
import { getCurrentUser, requireAdmin, requireEditor, requireUser } from "./dal";
import { AuthAccessError } from "./dal-core";
import { AuthConfigurationError } from "./config";

describe("server DAL wrappers (unit, mocked request and database)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getPrisma.mockReturnValue({ user: { findUnique: mocks.findUnique } });
    mocks.headers.mockResolvedValue(new Headers({ cookie: "session=opaque" }));
    mocks.getSession.mockResolvedValue({ user: { id: "database-user-id" } });
    mocks.findUnique.mockResolvedValue({ id: "database-user-id", role: "admin", isActive: true });
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([getCurrentUser, requireUser, requireEditor, requireAdmin])(
    "forwards the actual request headers with cookie cache and refresh disabled", async (lookup) => {
      const headers = new Headers({ cookie: "session=opaque" });
      mocks.headers.mockResolvedValue(headers);
      mocks.getSession.mockResolvedValue({ user: { id: "database-user-id", role: "viewer" } });
      mocks.findUnique.mockResolvedValue({ id: "database-user-id", role: "admin", isActive: true });
      await expect(lookup()).resolves.toMatchObject({ role: "admin" });
      expect(mocks.getSession).toHaveBeenCalledWith({
        headers, query: { disableCookieCache: true, disableRefresh: true },
      });
      expect(mocks.findUnique).toHaveBeenCalledTimes(1);
    },
  );

  it("reads new headers and database permissions on every protected request", async () => {
    const first = new Headers({ cookie: "session=first" });
    const next = new Headers({ cookie: "session=next" });
    mocks.headers.mockResolvedValueOnce(first).mockResolvedValueOnce(next);
    mocks.getSession.mockResolvedValue({ user: { id: "database-user-id" } });
    mocks.findUnique.mockResolvedValueOnce({ id: "database-user-id", role: "admin", isActive: true })
      .mockResolvedValueOnce({ id: "database-user-id", role: "viewer", isActive: true });
    await expect(requireAdmin()).resolves.toMatchObject({ role: "admin" });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 403 });
    expect(mocks.getSession.mock.calls.map(([input]) => input.headers)).toEqual([first, next]);
  });

  for (const [name, lookup] of Object.entries({ getCurrentUser, requireUser, requireEditor, requireAdmin })) {
    it.each(["database", "session"] as const)(`${name} sanitizes a %s failure without hiding it as an authorization denial`, async (boundary) => {
      const sensitiveMarker = "SECRET_DATABASE_PASSWORD_AND_SQL";
      const failure = new Error(`PrismaClient: SELECT users with ${sensitiveMarker}`, { cause: new Error(sensitiveMarker) });
      const logger = vi.spyOn(console, "error").mockImplementation(() => {});
      (boundary === "database" ? mocks.findUnique : mocks.getSession).mockRejectedValue(failure);
      const error = await lookup().catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBe(failure);
      expect(error).toMatchObject({ message: "Authentication service unavailable" });
      expect(error).not.toBeInstanceOf(AuthAccessError);
      expect(error).not.toHaveProperty("status");
      expect(error).not.toHaveProperty("cause");
      expect(String(error)).not.toContain(sensitiveMarker);
      expect(logger.mock.calls.flat().map(String).join(" ")).not.toContain(sensitiveMarker);
    });
  }

  it("sanitizes synchronous database initialization failures", async () => {
    const failure = new Error("postgresql://user:SECRET_DATABASE_PASSWORD@host/database");
    mocks.getPrisma.mockImplementation(() => { throw failure; });
    await expect(requireEditor()).rejects.toThrow("Authentication service unavailable");
  });

  it.each([
    new AuthAccessError(401, "UNAUTHENTICATED"),
    new AuthAccessError(403, "FORBIDDEN"),
    new AuthAccessError(403, "USER_INACTIVE"),
    new AuthConfigurationError("GOOGLE_CLIENT_ID"),
  ])("preserves the known-safe %s error unchanged", async (error) => {
    mocks.getSession.mockRejectedValue(error);
    await expect(requireEditor()).rejects.toBe(error);
  });
});
