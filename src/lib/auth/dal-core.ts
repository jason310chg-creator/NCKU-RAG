import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";

const currentUserSelect = {
  id: true, name: true, email: true, role: true, isActive: true,
} satisfies Prisma.UserSelect;

export type CurrentUser = Prisma.UserGetPayload<{ select: typeof currentUserSelect }>;
export type SessionLookup = (headers: Headers) => Promise<{ user: { id: string } } | null>;
export type AuthAccessCode = "UNAUTHENTICATED" | "USER_INACTIVE" | "FORBIDDEN";

export class AuthAccessError extends Error {
  constructor(readonly status: 401 | 403, readonly code: AuthAccessCode) {
    super(code === "UNAUTHENTICATED" ? "Authentication required" : "Access denied");
    this.name = "AuthAccessError";
  }
}

/** The supplied session lookup must verify the session with Better Auth on the server. */
export function createAuthDal(prisma: Pick<PrismaClient, "user">, getSession: SessionLookup) {
  async function getCurrentUser(headers: Headers): Promise<CurrentUser | null> {
    const session = await getSession(headers);
    if (!session) return null;
    // Never cache this read or use a session role snapshot for authorization.
    return prisma.user.findUnique({
      where: { id: session.user.id },
      select: currentUserSelect,
    });
  }

  async function requireUser(headers: Headers): Promise<CurrentUser> {
    const user = await getCurrentUser(headers);
    if (!user) throw new AuthAccessError(401, "UNAUTHENTICATED");
    if (!user.isActive) throw new AuthAccessError(403, "USER_INACTIVE");
    return user;
  }

  async function requireEditor(headers: Headers): Promise<CurrentUser> {
    const user = await requireUser(headers);
    if (user.role !== Role.editor && user.role !== Role.admin) {
      throw new AuthAccessError(403, "FORBIDDEN");
    }
    return user;
  }

  async function requireAdmin(headers: Headers): Promise<CurrentUser> {
    const user = await requireUser(headers);
    if (user.role !== Role.admin) throw new AuthAccessError(403, "FORBIDDEN");
    return user;
  }

  return { getCurrentUser, requireUser, requireEditor, requireAdmin };
}
