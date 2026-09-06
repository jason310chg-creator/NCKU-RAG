// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ readAuthConfig: vi.fn(), getPrisma: vi.fn(), createAuth: vi.fn() }));
vi.mock("./config", () => ({ readAuthConfig: mocks.readAuthConfig }));
vi.mock("../prisma", () => ({ getPrisma: mocks.getPrisma }));
vi.mock("./core", () => ({ createAuth: mocks.createAuth }));

describe("server auth initialization (unit, no credentials or database)", () => {
  afterEach(() => { vi.resetAllMocks(); vi.resetModules(); });

  it("does not initialize auth or read configuration during import", async () => {
    await import("./server");
    expect(mocks.readAuthConfig).not.toHaveBeenCalled();
    expect(mocks.getPrisma).not.toHaveBeenCalled();
    expect(mocks.createAuth).not.toHaveBeenCalled();
  });

  it("fails clearly for missing configuration before touching the database", async () => {
    const error = new Error("Missing or invalid BETTER_AUTH_SECRET");
    mocks.readAuthConfig.mockImplementation(() => { throw error; });
    const { getAuth } = await import("./server");
    expect(() => getAuth()).toThrow(error);
    expect(mocks.getPrisma).not.toHaveBeenCalled();
    expect(mocks.createAuth).not.toHaveBeenCalled();
  });

  it("creates auth with explicit config and reuses the configured instance", async () => {
    const config = { baseURL: "https://unit.example.com" };
    const prisma = {};
    const auth = {};
    mocks.readAuthConfig.mockReturnValue(config);
    mocks.getPrisma.mockReturnValue(prisma);
    mocks.createAuth.mockReturnValue(auth);
    const { getAuth } = await import("./server");
    expect(getAuth()).toBe(auth);
    expect(getAuth()).toBe(auth);
    expect(mocks.createAuth).toHaveBeenCalledExactlyOnceWith(prisma, config);
  });
});
