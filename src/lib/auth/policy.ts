import { DocumentStatus, Role, Visibility } from "../../generated/prisma/enums";
import type { CurrentUser } from "./dal-core";

type PolicyUser = Pick<CurrentUser, "id" | "role" | "isActive">;
type PolicyDocument = {
  ownerId: string | null;
  status: DocumentStatus;
  visibility: Visibility;
};

/** Call with a user freshly verified by the server DAL, never client/session role data. */
export function canReadAdminDocument(user: PolicyUser | null, document: PolicyDocument): boolean {
  if (!user?.isActive) return false;
  if (user.role === Role.admin) return true;
  return user.role === Role.editor && document.visibility !== Visibility.admin_only;
}

/** A policy decision alone does not authorize a later mutation with a stale user. */
export function canEditDocument(user: PolicyUser | null, document: PolicyDocument): boolean {
  if (!user || !canReadAdminDocument(user, document)) return false;
  return user.role === Role.admin ||
    (document.status === DocumentStatus.draft && document.ownerId === user.id);
}
