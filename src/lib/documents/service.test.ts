import { describe, expect, it, vi } from "vitest";
import { createDocumentService } from "./service";
import { publicDocumentWhere } from "./repository";
import { serializeDocument, serializeDocumentDetail } from "./serialization";
import type { PublicDocumentRecord } from "./repository";

export const record: PublicDocumentRecord = {
  id: "a9cfbb80-8fa7-4e39-b842-4c6186d06053", title: "Course guide", content: "Full text",
  contentType: "faq", category: "department_cs", subcategory: "course",
  sourceType: "official", sourceName: "CS", sourceUrl: "https://example.com/guide",
  visibility: "public", status: "published", validFrom: new Date("2026-05-13Z"),
  validUntil: null, version: 2, updatedAt: new Date("2026-05-13T02:00:00Z"),
  tags: [{ tag: { name: "B" } }, { tag: { name: "A" } }],
};

describe("document queries, service and serialization (unit)", () => {
  const now = new Date("2026-05-12T16:00:00Z");
  it("always constrains status, visibility and both DATE boundaries", () => {
    expect(publicDocumentWhere({ limit: 20, offset: 0 }, now)).toEqual({
      status: "published", visibility: "public", AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: new Date("2026-05-13Z") } }] },
        { OR: [{ validUntil: null }, { validUntil: { gte: new Date("2026-05-13Z") } }] },
      ],
    });
  });
  it("combines all filters with mandatory publication conditions", () => {
    expect(publicDocumentWhere({ limit: 1, offset: 2, category: "department_cs", subcategory: "course", tag: "A", contentType: "faq", updatedAfter: now }, now)).toMatchObject({
      status: "published", visibility: "public", category: "department_cs", subcategory: "course",
      tags: { some: { tag: { name: "A" } } }, contentType: "faq", updatedAt: { gt: now },
    });
  });
  it("serializes an explicit snake_case allowlist, tags and date-only values", () => {
    const extra = { ...record, ownerId: "private", files: [{ fileUrl: "private" }], createdAt: now };
    expect(serializeDocument(extra)).toEqual({
      id: record.id, title: record.title, content_type: "faq", category: "department_cs", subcategory: "course",
      source_type: "official", source_name: "CS", source_url: record.sourceUrl,
      visibility: "public", status: "published", valid_from: "2026-05-13", valid_until: null,
      version: 2, updated_at: "2026-05-13T02:00:00.000Z", tags: ["A", "B"],
    });
    expect(serializeDocumentDetail(extra)).toEqual({ ...serializeDocument(extra), content: "Full text" });
    expect(serializeDocumentDetail({ ...record, content: null }).content).toBeNull();
  });
  it("returns pagination and uses one clock value per operation", async () => {
    const repository = { list: vi.fn().mockResolvedValue({ documents: [record], total: 3 }), detail: vi.fn().mockResolvedValue(record) };
    const service = createDocumentService(repository, () => now);
    expect(await service.list({ limit: 1, offset: 2 })).toEqual({ data: [serializeDocument(record)], pagination: { limit: 1, offset: 2, total: 3 } });
    expect(repository.list).toHaveBeenCalledWith({ limit: 1, offset: 2 }, now);
    expect(await service.detail(record.id)).toEqual(serializeDocumentDetail(record));
    expect(repository.detail).toHaveBeenCalledWith(record.id, now);
  });
  it("preserves missing records and propagates database failures", async () => {
    const failure = new Error("database unavailable");
    const repository = { list: vi.fn().mockRejectedValue(failure), detail: vi.fn().mockResolvedValue(null) };
    const service = createDocumentService(repository);
    expect(await service.detail(record.id)).toBeNull();
    await expect(service.list({ limit: 20, offset: 0 })).rejects.toThrow(failure);
    repository.detail.mockRejectedValue(failure);
    await expect(service.detail(record.id)).rejects.toThrow(failure);
  });
});
