import type { DocumentRepository } from "./repository";
import { serializeDocument, serializeDocumentDetail } from "./serialization";
import type { DocumentQuery } from "./validation";

export function createDocumentService(repository: DocumentRepository, clock = () => new Date()) {
  return {
    async list(query: DocumentQuery) {
      const { documents, total } = await repository.list(query, clock());
      return { data: documents.map(serializeDocument), pagination: { limit: query.limit, offset: query.offset, total } };
    },
    async detail(id: string) {
      const document = await repository.detail(id, clock());
      return document === null ? null : serializeDocumentDetail(document);
    },
  };
}
