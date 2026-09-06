import { dateOnly } from "../domain";
import type { PublicDocumentMetadata, PublicDocumentRecord } from "./repository";

export function serializeDocument(document: PublicDocumentMetadata) {
  return {
    id: document.id, title: document.title, content_type: document.contentType,
    category: document.category, subcategory: document.subcategory,
    tags: document.tags.map(({ tag }) => tag.name).sort(),
    source_type: document.sourceType, source_name: document.sourceName, source_url: document.sourceUrl,
    visibility: document.visibility, status: document.status,
    valid_from: document.validFrom === null ? null : dateOnly(document.validFrom),
    valid_until: document.validUntil === null ? null : dateOnly(document.validUntil),
    version: document.version, updated_at: document.updatedAt.toISOString(),
  };
}

export function serializeDocumentDetail(document: PublicDocumentRecord) {
  return { ...serializeDocument(document), content: document.content };
}
