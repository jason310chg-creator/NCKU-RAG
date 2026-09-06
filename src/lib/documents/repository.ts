import type { Prisma, PrismaClient } from "../../generated/prisma/client";
import { taipeiDate } from "../domain";
import type { DocumentQuery } from "./validation";

const publicMetadataSelect = {
  id: true, title: true, contentType: true, category: true, subcategory: true,
  sourceType: true, sourceName: true, sourceUrl: true, visibility: true, status: true,
  validFrom: true, validUntil: true, version: true, updatedAt: true,
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.DocumentSelect;
const publicDetailSelect = { ...publicMetadataSelect, content: true } satisfies Prisma.DocumentSelect;

export type PublicDocumentMetadata = Prisma.DocumentGetPayload<{ select: typeof publicMetadataSelect }>;
export type PublicDocumentRecord = Prisma.DocumentGetPayload<{ select: typeof publicDetailSelect }>;

export interface DocumentRepository {
  list(query: DocumentQuery, now: Date): Promise<{ documents: PublicDocumentMetadata[]; total: number }>;
  detail(id: string, now: Date): Promise<PublicDocumentRecord | null>;
}

/** SQL equivalent of isPublicDocument. Both use inclusive Taipei calendar days. */
export function publicDocumentWhere(query: DocumentQuery, now: Date): Prisma.DocumentWhereInput {
  const today = taipeiDate(now);
  return {
    status: "published", visibility: "public",
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: today } }] },
      { OR: [{ validUntil: null }, { validUntil: { gte: today } }] },
    ],
    ...(query.category === undefined ? {} : { category: query.category }),
    ...(query.subcategory === undefined ? {} : { subcategory: query.subcategory }),
    ...(query.tag === undefined ? {} : { tags: { some: { tag: { name: query.tag } } } }),
    ...(query.contentType === undefined ? {} : { contentType: query.contentType }),
    ...(query.updatedAfter === undefined ? {} : { updatedAt: { gt: query.updatedAfter } }),
  };
}

export function createDocumentRepository(prisma: PrismaClient): DocumentRepository {
  return {
    async list(query, now) {
      const where = publicDocumentWhere(query, now);
      // Count and page share a snapshot even when concurrent writes occur.
      const [documents, total] = await prisma.$transaction([
        prisma.document.findMany({
          where, select: publicMetadataSelect, take: query.limit, skip: query.offset,
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        }),
        prisma.document.count({ where }),
      ], { isolationLevel: "RepeatableRead" });
      return { documents, total };
    },
    detail(id, now) {
      return prisma.document.findFirst({
        where: { ...publicDocumentWhere({ limit: 1, offset: 0 }, now), id },
        select: publicDetailSelect,
      });
    },
  };
}
