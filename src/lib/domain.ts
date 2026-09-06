export const contentTypes = ["faq", "document", "link", "structured"] as const;
export const documentStatuses = ["draft", "published", "archived"] as const;
export const roles = ["admin", "editor", "viewer"] as const;
export const sourceTypes = [
  "official",
  "student_association",
  "senior_experience",
  "community",
  "external",
  "unknown",
] as const;
export const visibilityLevels = ["public", "department_only", "admin_only"] as const;

export type ContentType = (typeof contentTypes)[number];
export type DocumentStatus = (typeof documentStatuses)[number];
export type Role = (typeof roles)[number];
export type SourceType = (typeof sourceTypes)[number];
export type Visibility = (typeof visibilityLevels)[number];

type PublicationInput = {
  status: DocumentStatus;
  validFrom?: Date | null;
  validUntil?: Date | null;
  visibility: Visibility;
  now?: Date;
};

/** A PostgreSQL DATE is represented by its UTC date, not a timestamp. */
export function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Today's Taipei calendar date encoded as UTC midnight for Prisma @db.Date. */
export function taipeiDate(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00.000Z`);
}

function isPublishedAndValid(input: PublicationInput): boolean {
  const today = dateOnly(taipeiDate(input.now ?? new Date()));
  const from = input.validFrom == null ? null : dateOnly(input.validFrom);
  const until = input.validUntil == null ? null : dateOnly(input.validUntil);
  return input.status === "published" &&
    (from === null || from <= today) && (until === null || until >= today);
}

export function isPublicDocument(input: PublicationInput): boolean {
  return isPublishedAndValid(input) && input.visibility === "public";
}

/** Future authorized departmental export only; never use as public API policy. */
export function isRagExportable(input: PublicationInput): boolean {
  return isPublishedAndValid(input) &&
    (input.visibility === "public" || input.visibility === "department_only");
}
