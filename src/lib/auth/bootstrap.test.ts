// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { bootstrapAdmin, parseBootstrapArguments } from "./bootstrap";

const ADMIN_ID = "660817a0-539f-4b20-baa2-8bbf46ccf1ef";

function database() {
  const tx = {
    $executeRaw: vi.fn().mockResolvedValue(1),
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: ADMIN_ID }),
      update: vi.fn().mockResolvedValue({ id: ADMIN_ID }),
    },
  };
  const transaction = vi.fn(async (work: (value: typeof tx) => Promise<unknown>) => work(tx));
  return { tx, transaction, client: { $transaction: transaction } as unknown as PrismaClient };
}

describe("first administrator bootstrap (unit; database concurrency tested in PostgreSQL)", () => {
  let db: ReturnType<typeof database>;
  beforeEach(() => { db = database(); });

  it("creates an active first admin using only the explicit normalized email and name", async () => {
    await expect(bootstrapAdmin(db.client, {
      email: "  First.Last+Owner@Example.COM  ", name: "  Initial Admin  ",
    })).resolves.toEqual({ userId: ADMIN_ID, created: true });
    expect(db.tx.user.create).toHaveBeenCalledWith({
      data: { email: "first.last+owner@example.com", name: "Initial Admin", role: "admin", isActive: true, emailVerified: false },
      select: { id: true },
    });
    expect(db.tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(db.tx.user.findFirst.mock.invocationCallOrder[0]);
    expect(db.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
  });

  it("repeating the same active administrator is an idempotent no-op", async () => {
    db.tx.user.findFirst.mockResolvedValue({ id: ADMIN_ID, email: "admin@example.com", isActive: true });
    await expect(bootstrapAdmin(db.client, { email: "ADMIN@example.com", name: "A different name" }))
      .resolves.toEqual({ userId: ADMIN_ID, created: false });
    expect(db.tx.user.create).not.toHaveBeenCalled();
    expect(db.tx.user.update).not.toHaveBeenCalled();
  });

  it("refuses a different email when any administrator already exists", async () => {
    db.tx.user.findFirst.mockResolvedValue({ id: ADMIN_ID, email: "existing@example.com", isActive: true });
    await expect(bootstrapAdmin(db.client, { email: "new@example.com", name: "New" }))
      .rejects.toMatchObject({ code: "ADMIN_ALREADY_EXISTS" });
    expect(db.tx.user.create).not.toHaveBeenCalled();
    expect(db.tx.user.update).not.toHaveBeenCalled();
  });

  it("does not treat an inactive existing administrator as permission to create another", async () => {
    db.tx.user.findFirst.mockResolvedValue({ id: ADMIN_ID, email: "existing@example.com", isActive: false });
    await expect(bootstrapAdmin(db.client, { email: "new@example.com", name: "New" }))
      .rejects.toMatchObject({ code: "ADMIN_ALREADY_EXISTS" });
    expect(db.tx.user.create).not.toHaveBeenCalled();
  });

  it("does not reactivate an existing administrator via an idempotent rerun", async () => {
    db.tx.user.findFirst.mockResolvedValue({ id: ADMIN_ID, email: "admin@example.com", isActive: false });
    await expect(bootstrapAdmin(db.client, { email: "admin@example.com", name: "Admin" }))
      .rejects.toMatchObject({ code: "ADMIN_INACTIVE" });
    expect(db.tx.user.update).not.toHaveBeenCalled();
  });

  it("can provision the explicitly named existing first user while preserving its UUID", async () => {
    db.tx.user.findUnique.mockResolvedValue({ id: ADMIN_ID });
    await expect(bootstrapAdmin(db.client, { email: "existing@example.com", name: "Initial Admin" }))
      .resolves.toEqual({ userId: ADMIN_ID, created: false });
    expect(db.tx.user.update).toHaveBeenCalledWith({
      where: { id: ADMIN_ID },
      data: { name: "Initial Admin", role: "admin", isActive: true },
      select: { id: true },
    });
    expect(db.tx.user.create).not.toHaveBeenCalled();
  });

  it.each([
    { email: "", name: "Admin" },
    { email: "bad address@example.com", name: "Admin" },
    { email: "admin@example.com", name: " " },
  ])("rejects invalid explicit input before accessing the database: %j", async (input) => {
    await expect(bootstrapAdmin(db.client, input)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("propagates database failure rather than reporting successful bootstrap", async () => {
    const failure = new Error("transaction failed");
    db.tx.user.create.mockRejectedValue(failure);
    await expect(bootstrapAdmin(db.client, { email: "admin@example.com", name: "Admin" })).rejects.toBe(failure);
  });
});

describe("bootstrap CLI arguments", () => {
  it("requires explicit email and name, accepting either argument order", () => {
    expect(parseBootstrapArguments(["--name", "Initial Admin", "--email", "ADMIN@example.com"]))
      .toEqual({ email: "admin@example.com", name: "Initial Admin" });
  });

  it.each([
    [],
    ["--email", "admin@example.com"],
    ["--email", "admin@example.com", "--name"],
    ["--email", "admin@example.com", "--name", "Admin", "--password", "anything"],
    ["--email", "admin@example.com", "--email", "another@example.com", "--name", "Admin"],
    ["admin@example.com", "Admin"],
  ].map((args) => ({ args })))("rejects missing, duplicate, unsupported or positional arguments: %j", ({ args }) => {
    expect(() => parseBootstrapArguments(args)).toThrow("Usage: bootstrap:admin -- --email <email> --name <name>");
  });
});
