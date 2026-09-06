import { describe, expect, it } from "vitest";
import { parseDocumentId, parseDocumentQuery } from "./validation";

describe("document request validation", () => {
  it("defaults bounded pagination", () => {
    expect(parseDocumentQuery(new URLSearchParams())).toEqual({ limit: 20, offset: 0 });
  });
  it("maps snake_case inputs to camelCase internal values", () => {
    expect(parseDocumentQuery(new URLSearchParams("category=department_cs&subcategory=course&tag=required&content_type=faq&updated_after=2026-05-13T10%3A00%3A00%2B08%3A00&limit=100&offset=2"))).toEqual({
      category: "department_cs", subcategory: "course", tag: "required", contentType: "faq",
      updatedAfter: new Date("2026-05-13T02:00:00Z"), limit: 100, offset: 2,
    });
  });
  it.each([
    "content_type=bad", "updated_after=bad", "updated_after=2026-02-30T00:00:00Z",
    "updated_after=2026-05-13", "updated_after=2026-05-13T00:00:00", "limit=-1", "offset=-1",
    "limit=0", "limit=101", "limit=1.5", "limit=1e2", "limit=", "offset=Infinity",
    "offset=2147483648", "limit=20&limit=30", "status=draft", "visibility=department_only",
    "status=published", "contentType=faq", "category=", "tag=%20", "unknown=x",
  ])("rejects %s", (query) => {
    expect(() => parseDocumentQuery(new URLSearchParams(query))).toThrow();
  });
  it("allows category and subcategory strings because the schema does not define enums", () => {
    expect(parseDocumentQuery(new URLSearchParams("category=custom&subcategory=custom"))).toMatchObject({ category: "custom", subcategory: "custom" });
  });
  it("validates UUIDs", () => {
    expect(parseDocumentId("A9CFBB80-8FA7-4E39-B842-4C6186D06053")).toBe("a9cfbb80-8fa7-4e39-b842-4c6186d06053");
    expect(() => parseDocumentId("bad-id")).toThrow();
  });
});
