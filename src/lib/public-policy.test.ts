import { describe, expect, it } from "vitest";
import { isPublicDocument, isRagExportable, taipeiDate } from "./domain";

describe("publication policies and DATE semantics", () => {
  const base = { status: "published", visibility: "public", now: new Date("2026-05-13T12:00:00Z") } as const;
  it("allows published public documents with unbounded dates", () => {
    expect(isPublicDocument(base)).toBe(true);
  });
  it.each(["draft", "archived"] as const)("rejects %s", (status) => {
    expect(isPublicDocument({ ...base, status })).toBe(false);
    expect(isRagExportable({ ...base, status })).toBe(false);
  });
  it.each(["department_only", "admin_only"] as const)("hides %s publicly", (visibility) => {
    expect(isPublicDocument({ ...base, visibility })).toBe(false);
  });
  it("preserves the separate future departmental export policy", () => {
    expect(isRagExportable({ ...base, visibility: "department_only" })).toBe(true);
    expect(isRagExportable({ ...base, visibility: "admin_only" })).toBe(false);
  });
  it.each([isPublicDocument, isRagExportable])("includes both boundary dates for the whole Taipei day", (policy) => {
    const dates = { validFrom: new Date("2026-05-13T00:00:00Z"), validUntil: new Date("2026-05-13T00:00:00Z") };
    expect(policy({ ...base, ...dates, now: new Date("2026-05-12T15:59:59.999Z") })).toBe(false);
    expect(policy({ ...base, ...dates, now: new Date("2026-05-12T16:00:00Z") })).toBe(true);
    expect(policy({ ...base, ...dates, now: dates.validFrom })).toBe(true);
    expect(policy({ ...base, ...dates, now: new Date("2026-05-13T15:59:59.999Z") })).toBe(true);
    expect(policy({ ...base, ...dates, now: new Date("2026-05-13T16:00:00Z") })).toBe(false);
  });
  it("represents Taipei calendar dates as UTC midnight for PostgreSQL DATE comparisons", () => {
    expect(taipeiDate(new Date("2026-05-12T16:00:00Z")).toISOString()).toBe("2026-05-13T00:00:00.000Z");
  });
  it("rejects invalid dates explicitly", () => {
    expect(() => isPublicDocument({ ...base, validFrom: new Date("invalid") })).toThrow();
  });
});
