import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../../src/generated/prisma/client";
import { createDocumentRepository } from "../../src/lib/documents/repository";
import { createDocumentService } from "../../src/lib/documents/service";
import { parseDocumentQuery } from "../../src/lib/documents/validation";
import { isPublicDocument } from "../../src/lib/domain";

// Refuse arbitrary URLs, including DATABASE_URL from a developer's .env.
const testUrl = "postgresql://kb_test@127.0.0.1:55433/kb_platform_test?schema=public";
if (process.env.TEST_DATABASE_URL !== testUrl || process.env.DATABASE_URL !== testUrl) {
  throw new Error("Use npm run test:integration with the isolated Compose test database");
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl, connectionTimeoutMillis: 3000 }) });
const now = new Date("2026-05-13T12:00:00Z");
const repository = createDocumentRepository(prisma);
const service = createDocumentService(repository, () => now);
vi.mock("../../src/lib/documents/public-service", () => ({ getPublicDocumentService: () => service }));
import { GET as detail } from "../../src/app/api/v1/documents/[id]/route";
import { GET as list } from "../../src/app/api/v1/documents/route";

const id = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
const data = (number: number, overrides: Partial<Prisma.DocumentCreateInput> = {}): Prisma.DocumentCreateInput => ({
  id: id(number), title: `Document ${number}`, content: "Full text", contentType: "faq",
  category: "department_cs", subcategory: "course", status: "published", visibility: "public",
  sourceType: "official", sourceName: "CS", sourceUrl: "https://example.com/guide",
  updatedAt: new Date("2026-05-13T02:00:00Z"), ...overrides,
});
const query = (value = "") => parseDocumentQuery(new URLSearchParams(value));
const request = (value = "") => new Request(`http://localhost/api/v1/documents${value}`);

describe("real PostgreSQL document API", () => {
  beforeAll(async () => { await prisma.$connect(); });
  beforeEach(async () => {
    await prisma.document.deleteMany();
    await prisma.tag.deleteMany();
    await prisma.document.create({ data: data(1, {
      validFrom: new Date("2026-05-13Z"), validUntil: new Date("2026-05-13Z"),
      tags: { create: [{ tag: { create: { name: "B" } } }, { tag: { create: { name: "A" } } }] },
    }) });
    await prisma.document.create({ data: data(2) });
    await prisma.document.create({ data: data(3, { category: "freshman", subcategory: "equipment", contentType: "link", updatedAt: new Date("2026-05-12Z") }) });
    for (const [index, overrides] of [
      { status: "draft" }, { status: "archived" }, { visibility: "admin_only" },
      { visibility: "department_only" }, { validFrom: new Date("2026-05-14Z") }, { validUntil: new Date("2026-05-12Z") },
    ].entries()) {
      await prisma.document.create({ data: data(index + 10, overrides as Partial<Prisma.DocumentCreateInput>) });
    }
  });
  afterAll(async () => { await prisma.$disconnect(); });

  it("matches the domain policy in SQL and hides every ineligible row from the list", async () => {
    const rows = await prisma.document.findMany();
    const expected = rows.filter((row) => isPublicDocument({ ...row, now })).map((row) => row.id).sort();
    const result = await service.list(query());
    expect(result.data.map((row) => row.id).sort()).toEqual(expected);
    expect(result.pagination.total).toBe(3);
    const response = await list(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);
  });
  it.each([10, 11, 12, 13, 14, 15, 999])("returns identical 404 for hidden or missing record %s", async (number) => {
    const response = await detail(request(), { params: Promise.resolve({ id: id(number) }) });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "not_found", message: "Document not found" } });
  });
  it.each([
    ["category=freshman", [3]], ["subcategory=equipment", [3]], ["tag=A", [1]],
    ["content_type=link", [3]], ["updated_after=2026-05-13T02:00:00Z", []],
    ["updated_after=2026-05-13T01:59:59Z", [1, 2]],
    ["category=department_cs&subcategory=course&tag=B&content_type=faq", [1]],
  ] as const)("filters %s and counts after filtering", async (value, numbers) => {
    const result = await service.list(query(value));
    expect(result.data.map((row) => row.id)).toEqual(numbers.map(id));
    expect(result.pagination.total).toBe(numbers.length);
  });
  it("paginates deterministically across timestamp ties and retains total beyond the last page", async () => {
    expect((await service.list(query("limit=1&offset=0"))).data.map((row) => row.id)).toEqual([id(1)]);
    expect((await service.list(query("limit=1&offset=1"))).data.map((row) => row.id)).toEqual([id(2)]);
    expect(await service.list(query("limit=1&offset=99"))).toEqual({ data: [], pagination: { limit: 1, offset: 99, total: 3 } });
  });
  it("serializes DATEs, sorted tag names, full content and excludes internal fields", async () => {
    const result = await service.detail(id(1));
    expect(result).toMatchObject({ content: "Full text", tags: ["A", "B"], valid_from: "2026-05-13", valid_until: "2026-05-13", updated_at: "2026-05-13T02:00:00.000Z" });
    expect(result).not.toHaveProperty("owner_id");
    expect(result).not.toHaveProperty("files");
    expect(result).not.toHaveProperty("created_at");
  });
  it("applies inclusive Taipei day boundaries in real DATE queries", async () => {
    expect(await repository.detail(id(1), new Date("2026-05-12T15:59:59.999Z"))).toBeNull();
    expect(await repository.detail(id(1), new Date("2026-05-12T16:00:00Z"))).not.toBeNull();
    expect(await repository.detail(id(1), new Date("2026-05-13T15:59:59.999Z"))).not.toBeNull();
    expect(await repository.detail(id(1), new Date("2026-05-13T16:00:00Z"))).toBeNull();
  });
});
