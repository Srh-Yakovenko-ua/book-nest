import { z } from "zod";

import { createPaginatedSchema, paginationQueryFields } from "./common.js";

export const TRASH_PAGE_SIZE_DEFAULT = 20;

export const TrashDeletionResultSchema = z.object({
  deletedAt: z.iso.datetime(),
  purgeAt: z.iso.datetime(),
});

export type TrashDeletionResult = z.infer<typeof TrashDeletionResultSchema>;

export const TrashEntityTypeSchema = z.enum([
  "book",
  "book_list",
  "character",
  "note",
  "quote",
  "series",
  "timeline",
]);

export type TrashEntityType = z.infer<typeof TrashEntityTypeSchema>;

export const TrashItemViewSchema = z.object({
  context: z.string().nullable(),
  deletedAt: z.iso.datetime(),
  entityType: TrashEntityTypeSchema,
  id: z.string(),
  purgeAt: z.iso.datetime(),
  title: z.string(),
});

export type TrashItemView = z.infer<typeof TrashItemViewSchema>;

export const TrashQuerySchema = z.object({
  entityType: TrashEntityTypeSchema.optional(),
  ...paginationQueryFields({ pageSizeDefault: TRASH_PAGE_SIZE_DEFAULT }),
});

export type TrashQuery = z.infer<typeof TrashQuerySchema>;

export const PaginatedTrashSchema = createPaginatedSchema(TrashItemViewSchema);

export type PaginatedTrash = z.infer<typeof PaginatedTrashSchema>;

export const TrashSummaryViewSchema = z.object({
  countsByType: z.partialRecord(TrashEntityTypeSchema, z.number().int()),
  retentionDays: z.number().int(),
  totalCount: z.number().int(),
});

export type TrashSummaryView = z.infer<typeof TrashSummaryViewSchema>;
