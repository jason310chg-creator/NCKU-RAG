import { getPublicDocumentService } from "../../../../lib/documents/public-service";
import { parseDocumentQuery } from "../../../../lib/documents/validation";
import { apiError, jsonResponse } from "../../../../lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const query = parseDocumentQuery(new URL(request.url).searchParams);
    return jsonResponse(await getPublicDocumentService().list(query));
  } catch (error) {
    return apiError(error);
  }
}
