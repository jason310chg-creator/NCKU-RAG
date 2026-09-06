import "server-only";
import { getPrisma } from "../prisma";
import { readAuthConfig } from "./config";
import { createAuth } from "./core";

let auth: ReturnType<typeof createAuth> | undefined;

/** Initialize only on a real auth request; no build-time credentials or defaults. */
export function getAuth() {
  if (!auth) {
    const config = readAuthConfig();
    auth = createAuth(getPrisma(), config);
  }
  return auth;
}
