import { config } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { BootstrapAdminError, bootstrapAdmin, parseBootstrapArguments } from "../src/lib/auth/bootstrap";

async function main(): Promise<void> {
  config({ quiet: true });
  const input = parseBootstrapArguments(process.argv.slice(2));
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }),
    log: [],
  });
  try {
    const result = await bootstrapAdmin(prisma, input);
    console.info(result.created ? "First administrator created." : "Administrator provisioning confirmed.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  if (error instanceof BootstrapAdminError) console.error(error.message);
  else if (error instanceof Error && error.message === "DATABASE_URL_REQUIRED") {
    console.error("DATABASE_URL is required for administrator bootstrap.");
  } else {
    // Prisma/driver errors can embed connection details, SQL and supplied values.
    console.error("Administrator bootstrap failed. Check database connectivity and applied migrations; no credentials or database error details are logged.");
  }
  process.exitCode = 1;
});
