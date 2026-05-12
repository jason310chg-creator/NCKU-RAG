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

export function isRagExportable(input: {
  status: DocumentStatus;
  validUntil?: Date | null;
  visibility: Visibility;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  if (input.status !== "published") {
    return false;
  }

  if (input.visibility === "admin_only") {
    return false;
  }

  if (input.validUntil && input.validUntil < now) {
    return false;
  }

  return true;
}
