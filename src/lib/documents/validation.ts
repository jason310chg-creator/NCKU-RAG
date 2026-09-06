import { z } from "zod";
import { contentTypes } from "../domain";

const textFilter = z.string().trim().min(1).max(200).optional();
const integer = (min: number, max: number, defaultValue: string) =>
  z.string().regex(/^\d+$/, "Expected an unsigned decimal integer")
    .default(defaultValue).transform(Number).pipe(z.number().int().min(min).max(max));

const querySchema = z.strictObject({
  category: textFilter,
  subcategory: textFilter,
  tag: textFilter,
  content_type: z.enum(contentTypes).optional(),
  updated_after: z.iso.datetime({ offset: true }).transform((value) => new Date(value)).optional(),
  limit: integer(1, 100, "20"),
  offset: integer(0, 2_147_483_647, "0"),
}).transform(({ content_type, updated_after, ...query }) => ({
  ...query, ...(content_type === undefined ? {} : { contentType: content_type }),
  ...(updated_after === undefined ? {} : { updatedAfter: updated_after }),
}));

export type DocumentQuery = z.output<typeof querySchema>;

export function parseDocumentQuery(params: URLSearchParams): DocumentQuery {
  const values: Record<string, string | string[]> = {};
  for (const key of new Set(params.keys())) {
    const entries = params.getAll(key);
    // Duplicate parameters fail schema validation instead of silently taking one.
    Object.defineProperty(values, key, { value: entries.length === 1 ? entries[0] : entries, enumerable: true });
  }
  return querySchema.parse(values);
}

export function parseDocumentId(id: string): string {
  return z.uuid().transform((value) => value.toLowerCase()).parse(id);
}
