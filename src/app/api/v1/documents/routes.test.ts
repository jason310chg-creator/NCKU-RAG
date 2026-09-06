// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn() }));
vi.mock("../../../../lib/documents/public-service", () => ({ getPublicDocumentService: () => service }));
import { GET as list } from "./route";
import { GET as detail } from "./[id]/route";

describe("public document HTTP handlers (unit)", () => {
  afterEach(() => vi.restoreAllMocks());
  const request = (query = "") => new Request(`http://localhost/api/v1/documents${query}`);
  const getDetail = (id: string) => detail(request(), { params: Promise.resolve({ id }) });
  it("returns a list response with no-store", async () => {
    const body = { data: [], pagination: { limit: 20, offset: 0, total: 0 } };
    service.list.mockResolvedValue(body);
    const response = await list(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual(body);
  });
  it.each(["?limit=-1", "?content_type=invalid", "?updated_after=2026-02-30T00:00:00Z", "?visibility=admin_only", "?status=draft"])("returns clear 400 for %s before data access", async (query) => {
    service.list.mockClear();
    const response = await list(request(query));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_request", issues: expect.any(Array) } });
    expect(service.list).not.toHaveBeenCalled();
  });
  it("returns 400 for malformed UUID before data access", async () => {
    service.detail.mockClear();
    expect((await getDetail("bad")).status).toBe(400);
    expect(service.detail).not.toHaveBeenCalled();
  });
  it("returns a detail body and identical 404 contract for unavailable records", async () => {
    service.detail.mockResolvedValue({ id: "example", content: "full" });
    expect(await (await getDetail("a9cfbb80-8fa7-4e39-b842-4c6186d06053")).json()).toEqual({ id: "example", content: "full" });
    service.detail.mockResolvedValue(null);
    const response = await getDetail("a9cfbb80-8fa7-4e39-b842-4c6186d06053");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "not_found", message: "Document not found" } });
  });
  it("reports unexpected errors server-side and returns generic 500 for both routes", async () => {
    const failure = new Error("private database details");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    service.list.mockRejectedValue(failure);
    service.detail.mockRejectedValue(failure);
    for (const response of [await list(request()), await getDetail("a9cfbb80-8fa7-4e39-b842-4c6186d06053")]) {
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: { code: "internal_error", message: "Internal server error" } });
    }
    expect(log).toHaveBeenCalledWith("Document API request failed", failure);
  });
});
