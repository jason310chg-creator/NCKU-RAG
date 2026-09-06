import { ZodError } from "zod";

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function apiError(error: unknown): Response {
  if (error instanceof ZodError) {
    return jsonResponse({ error: {
      code: "invalid_request", message: "Invalid request parameters",
      issues: error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message })),
    } }, 400);
  }
  console.error("Document API request failed", error);
  return jsonResponse({ error: { code: "internal_error", message: "Internal server error" } }, 500);
}
