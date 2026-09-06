/** Exact email identity. Never remove plus tags, dots, or match only a domain. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
