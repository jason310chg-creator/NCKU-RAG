// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ client: vi.fn(function () {}), adapter: vi.fn(function () {}) }));
vi.mock("../generated/prisma/client", () => ({ PrismaClient: mocks.client }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: mocks.adapter }));

describe("Prisma singleton (unit; no database)", () => {
  afterEach(() => {
    delete (globalThis as { prisma?: unknown }).prisma;
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.resetModules();
  });
  it("fails without configuration at request time, not module import time", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { getPrisma } = await import("./prisma");
    expect(mocks.client).not.toHaveBeenCalled();
    expect(() => getPrisma()).toThrow("DATABASE_URL is required");
  });
  it("reuses a client across calls and development hot reload", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/unit-test-placeholder");
    const { getPrisma } = await import("./prisma");
    const first = getPrisma();
    expect(getPrisma()).toBe(first);
    vi.resetModules();
    expect((await import("./prisma")).getPrisma()).toBe(first);
    expect(mocks.client).toHaveBeenCalledTimes(1);
    expect(mocks.adapter).toHaveBeenCalledTimes(1);
  });
});
