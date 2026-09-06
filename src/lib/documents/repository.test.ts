import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma/client";
import { createDocumentRepository } from "./repository";

describe("Prisma repository contract (unit, not SQL integration)", () => {
  it("uses stable ordering, a shared filter and a repeatable-read snapshot", async () => {
    const findMany = vi.fn().mockReturnValue("page operation");
    const count = vi.fn().mockReturnValue("count operation");
    const transaction = vi.fn().mockResolvedValue([[], 7]);
    // This double observes Prisma calls; it does not emulate PostgreSQL.
    const prisma = { document: { findMany, count }, $transaction: transaction } as unknown as PrismaClient;
    const result = await createDocumentRepository(prisma).list({ limit: 2, offset: 3, tag: "A" }, new Date("2026-05-13T12:00:00Z"));
    expect(result).toEqual({ documents: [], total: 7 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      take: 2, skip: 3, orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    }));
    expect(count).toHaveBeenCalledWith({ where: findMany.mock.calls[0][0].where });
    expect(transaction).toHaveBeenCalledWith(["page operation", "count operation"], { isolationLevel: "RepeatableRead" });
    const select = findMany.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("content");
    expect(select).not.toHaveProperty("ownerId");
    expect(select).not.toHaveProperty("files");
  });
  it("looks up a detail using the public filter in the same query", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { document: { findFirst } } as unknown as PrismaClient;
    expect(await createDocumentRepository(prisma).detail("id", new Date("2026-05-13T12:00:00Z"))).toBeNull();
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: "id", status: "published", visibility: "public", AND: expect.any(Array) }),
      select: expect.objectContaining({ content: true }),
    }));
  });
});
