import "server-only";
import { headers } from "next/headers";
import { getPrisma } from "../prisma";
import { AuthConfigurationError } from "./config";
import { AuthAccessError, createAuthDal } from "./dal-core";
import { getAuth } from "./server";

function requestDal() {
  return createAuthDal(getPrisma(), (requestHeaders) => getAuth().api.getSession({
    headers: requestHeaders,
    query: { disableCookieCache: true, disableRefresh: true },
  }));
}

async function withRequestDal<T>(lookup: (dal: ReturnType<typeof requestDal>, requestHeaders: Headers) => Promise<T>): Promise<T> {
  // Keep Next.js request-context control flow outside the database boundary.
  const requestHeaders = await headers();
  try {
    return await lookup(requestDal(), requestHeaders);
  } catch (error) {
    if (error instanceof AuthAccessError || error instanceof AuthConfigurationError) throw error;
    // Next.js may log rethrown Server Component errors. Drop adapter messages,
    // SQL, credentials and causes while preserving a genuine server failure.
    throw new Error("Authentication service unavailable");
  }
}

export async function getCurrentUser() {
  return withRequestDal((dal, requestHeaders) => dal.getCurrentUser(requestHeaders));
}

export async function requireUser() {
  return withRequestDal((dal, requestHeaders) => dal.requireUser(requestHeaders));
}

export async function requireEditor() {
  return withRequestDal((dal, requestHeaders) => dal.requireEditor(requestHeaders));
}

export async function requireAdmin() {
  return withRequestDal((dal, requestHeaders) => dal.requireAdmin(requestHeaders));
}
