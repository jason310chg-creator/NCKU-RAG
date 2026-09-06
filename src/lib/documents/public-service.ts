import "server-only";
import { getPrisma } from "../prisma";
import { createDocumentRepository } from "./repository";
import { createDocumentService } from "./service";

export function getPublicDocumentService() {
  return createDocumentService(createDocumentRepository(getPrisma()));
}
