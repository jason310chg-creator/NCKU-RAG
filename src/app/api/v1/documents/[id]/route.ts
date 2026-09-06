import { getPublicDocumentService } from "../../../../../lib/documents/public-service";
import { parseDocumentId } from "../../../../../lib/documents/validation";
import { apiError, jsonResponse } from "../../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const id = parseDocumentId((await context.params).id);
    const document = await getPublicDocumentService().detail(id);
    return document === null
      ? jsonResponse({ error: { code: "not_found", message: "Document not found" } }, 404)
      : jsonResponse(document);
  } catch (error) {
    return apiError(error);
  }
}
