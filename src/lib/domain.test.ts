import { describe, expect, it } from "vitest";
import { isRagExportable } from "./domain";

describe("isRagExportable", () => {
  const now = new Date("2026-05-13T00:00:00.000Z");

  it("allows published public documents that are still valid", () => {
    expect(
      isRagExportable({
        status: "published",
        visibility: "public",
        validUntil: new Date("2026-05-14T00:00:00.000Z"),
        now,
      }),
    ).toBe(true);
  });

  it("rejects draft documents", () => {
    expect(
      isRagExportable({
        status: "draft",
        visibility: "public",
        now,
      }),
    ).toBe(false);
  });

  it("rejects admin-only documents", () => {
    expect(
      isRagExportable({
        status: "published",
        visibility: "admin_only",
        now,
      }),
    ).toBe(false);
  });

  it("rejects expired documents", () => {
    expect(
      isRagExportable({
        status: "published",
        visibility: "public",
        validUntil: new Date("2026-05-12T00:00:00.000Z"),
        now,
      }),
    ).toBe(false);
  });
});
