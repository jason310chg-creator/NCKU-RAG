import { AuthConfigurationError } from "../../../../lib/auth/config";
import { isAllowedAuthRequest } from "../../../../lib/auth/core";
import { getAuth } from "../../../../lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  if (!isAllowedAuthRequest(request)) {
    return Response.json({ error: { code: "NOT_FOUND", message: "Not found" } }, {
      status: 404, headers: { "Cache-Control": "no-store" },
    });
  }
  try {
    const response = await getAuth().handler(request);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    const misconfigured = error instanceof AuthConfigurationError;
    // Raw provider/database errors can contain tokens, SQL, or credentials.
    console.error(misconfigured ? "Authentication configuration is missing or invalid" : "Authentication request failed");
    return Response.json({ error: {
      code: misconfigured ? "AUTH_CONFIGURATION_ERROR" : "INTERNAL_ERROR",
      message: misconfigured ? "Authentication is not configured" : "Authentication request failed",
    } }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export const GET = handle;
export const POST = handle;
