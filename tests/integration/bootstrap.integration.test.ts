import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient, Role } from "../../src/generated/prisma/client";
import { bootstrapAdmin } from "../../src/lib/auth/bootstrap";

const testUrl = "postgresql://kb_test@127.0.0.1:55433/kb_platform_test?schema=public";
if (process.env.TEST_DATABASE_URL !== testUrl || process.env.DATABASE_URL !== testUrl) {
  throw new Error("Use npm run test:integration with the isolated test database");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl, connectionTimeoutMillis: 3000 }) });

describe("real PostgreSQL first administrator bootstrap", () => {
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
        throw new Error("Refusing bootstrap fixtures: database is not the owned PostgreSQL 17 cluster");
      }
    }
  });

  beforeEach(async () => {
    await prisma.document.deleteMany();
    await prisma.user.deleteMany();
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it("creates one normalized active admin and repeats without changing identity, name or verification", async () => {
    const first = await bootstrapAdmin(prisma, { email: "  First.Last+Admin@Example.COM  ", name: "Initial Admin" });
    const second = await bootstrapAdmin(prisma, { email: "first.last+admin@example.com", name: "Different Name" });
    expect(first.created).toBe(true);
    expect(second).toEqual({ userId: first.userId, created: false });
    expect(await prisma.user.findMany()).toEqual([expect.objectContaining({
      id: first.userId, email: "first.last+admin@example.com", name: "Initial Admin",
      role: Role.admin, isActive: true, emailVerified: false,
    })]);
    expect(await prisma.account.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
  });

  it("serializes concurrent bootstrap for the same exact email without creating duplicate users", async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => bootstrapAdmin(prisma, {
      email: "concurrent@example.com", name: "Concurrent Admin",
    })));
    expect(new Set(results.map((result) => result.userId)).size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(await prisma.user.count({ where: { role: Role.admin, isActive: true } })).toBe(1);
  });

  it("lets only one of two different concurrent emails become the first administrator", async () => {
    const results = await Promise.allSettled([
      bootstrapAdmin(prisma, { email: "first.contender@example.com", name: "First" }),
      bootstrapAdmin(prisma, { email: "second.contender@example.com", name: "Second" }),
    ]);
    const succeeded = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: "ADMIN_ALREADY_EXISTS" });
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.user.count({ where: { role: Role.admin, isActive: true } })).toBe(1);
  });

  it("preserves an explicitly provisioned Phase 1 user's UUID and document ownership", async () => {
    const existing = await prisma.user.create({ data: {
      id: randomUUID(), email: "legacy.owner@example.com", name: "Legacy Owner", role: Role.editor,
    } });
    const document = await prisma.document.create({ data: {
      title: "Existing owner document", category: "department_cs", contentType: "document", ownerId: existing.id,
    } });
    expect(existing.isActive).toBe(false);
    const result = await bootstrapAdmin(prisma, { email: existing.email, name: "Initial Administrator" });
    expect(result).toEqual({ userId: existing.id, created: false });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: existing.id } })).toMatchObject({
      name: "Initial Administrator", role: Role.admin, isActive: true, emailVerified: false,
    });
    expect(await prisma.document.findUniqueOrThrow({ where: { id: document.id } })).toMatchObject({ ownerId: existing.id });
    expect(await prisma.user.count()).toBe(1);
  });

  it("does not elevate a different existing user after an administrator exists", async () => {
    await bootstrapAdmin(prisma, { email: "original.admin@example.com", name: "Original Admin" });
    const editor = await prisma.user.create({ data: {
      email: "different.editor@example.com", name: "Editor", role: Role.editor, isActive: true,
    } });
    await expect(bootstrapAdmin(prisma, { email: editor.email, name: "Attempted Admin" }))
      .rejects.toMatchObject({ code: "ADMIN_ALREADY_EXISTS" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: editor.id } })).toMatchObject({
      name: "Editor", role: Role.editor, isActive: true,
    });
    expect(await prisma.user.count({ where: { role: Role.admin } })).toBe(1);
  });

  it("does not reactivate an inactive administrator or create another through bootstrap", async () => {
    const result = await bootstrapAdmin(prisma, { email: "inactive.admin@example.com", name: "Admin" });
    await prisma.user.update({ where: { id: result.userId }, data: { isActive: false } });
    await expect(bootstrapAdmin(prisma, { email: "inactive.admin@example.com", name: "Admin" }))
      .rejects.toMatchObject({ code: "ADMIN_INACTIVE" });
    await expect(bootstrapAdmin(prisma, { email: "replacement.admin@example.com", name: "Replacement" }))
      .rejects.toMatchObject({ code: "ADMIN_ALREADY_EXISTS" });
    expect(await prisma.user.findMany()).toEqual([expect.objectContaining({ id: result.userId, isActive: false })]);
  });
});
