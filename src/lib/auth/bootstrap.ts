import { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client";
import { Role } from "../../generated/prisma/enums";
import { normalizeEmail } from "./email";

export type BootstrapAdminInput = { email: string; name: string };
export type BootstrapAdminResult = { userId: string; created: boolean };

type BootstrapErrorCode = "INVALID_INPUT" | "ADMIN_ALREADY_EXISTS" | "ADMIN_INACTIVE";

const errorMessages: Record<BootstrapErrorCode, string> = {
  INVALID_INPUT: "Usage: bootstrap:admin -- --email <email> --name <name>",
  ADMIN_ALREADY_EXISTS: "Bootstrap refused: an administrator already exists. Use the existing administrator to manage access.",
  ADMIN_INACTIVE: "Bootstrap refused: the existing administrator is inactive. Resolve access through an explicit operational recovery.",
};

export class BootstrapAdminError extends Error {
  constructor(readonly code: BootstrapErrorCode) {
    super(errorMessages[code]);
    this.name = "BootstrapAdminError";
  }
}

const inputSchema = z.object({
  email: z.string().transform(normalizeEmail).pipe(z.email()),
  name: z.string().trim().min(1).max(200),
}).strict();

function validateInput(input: BootstrapAdminInput): BootstrapAdminInput {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new BootstrapAdminError("INVALID_INPUT");
  return parsed.data;
}

export function parseBootstrapArguments(args: string[]): BootstrapAdminInput {
  const input: Partial<BootstrapAdminInput> = {};
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if ((option !== "--email" && option !== "--name") || !value || value.startsWith("--")) {
      throw new BootstrapAdminError("INVALID_INPUT");
    }
    const key = option === "--email" ? "email" : "name";
    if (input[key] !== undefined) throw new BootstrapAdminError("INVALID_INPUT");
    input[key] = value;
  }
  return validateInput(input as BootstrapAdminInput);
}

/**
 * Explicit operational provisioning, never called by login. The advisory lock
 * serializes concurrent bootstrap scripts; READ COMMITTED ensures a waiter sees
 * the administrator committed by the preceding holder after obtaining the lock.
 */
export async function bootstrapAdmin(prisma: PrismaClient, input: BootstrapAdminInput): Promise<BootstrapAdminResult> {
  const { email, name } = validateInput(input);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(721430210, 1)`;
    const admin = await tx.user.findFirst({
      where: { role: Role.admin },
      select: { id: true, email: true, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (admin) {
      if (admin.email !== email) throw new BootstrapAdminError("ADMIN_ALREADY_EXISTS");
      if (!admin.isActive) throw new BootstrapAdminError("ADMIN_INACTIVE");
      return { userId: admin.id, created: false };
    }

    const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      // The exact email is explicitly supplied by the operator. Preserve the
      // Phase 1 UUID and ownership; do not assert Google verification here.
      const user = await tx.user.update({
        where: { id: existing.id },
        data: { name, role: Role.admin, isActive: true },
        select: { id: true },
      });
      return { userId: user.id, created: false };
    }

    const user = await tx.user.create({
      data: { email, name, role: Role.admin, isActive: true, emailVerified: false },
      select: { id: true },
    });
    return { userId: user.id, created: true };
  }, { isolationLevel: "ReadCommitted" });
}
