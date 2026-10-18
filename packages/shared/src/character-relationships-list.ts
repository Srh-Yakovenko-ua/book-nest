import { z } from "zod";

import {
  READING_POSITION_QUERY_KEYS,
  RelationshipBookStateStatusSchema,
  RelationshipCategorySchema,
  RelationshipIntensitySchema,
  type RelationshipReaderScope,
  RelationshipReaderScopeSchema,
  RelationshipTypeSchema,
  SafeBookStateViewSchema,
  SafeRelationshipEdgeViewSchema,
} from "./character-relationships.js";
import {
  createPaginatedSchema,
  normalizeSearch,
  paginationQueryFields,
  readingPositionQueryFields,
} from "./common.js";
import { queryStringArray } from "./internal.js";

export const CHARACTER_RELATIONSHIP_LIST_LIMITS = {
  pageSizeDefault: 20,
  searchMax: 100,
  searchMin: 2,
} as const;

export const CharacterRelationshipListSortSchema = z.enum([
  "name_asc",
  "name_desc",
  "newest",
  "recently_updated",
]);

export type CharacterRelationshipListSort = z.infer<typeof CharacterRelationshipListSortSchema>;

const refineCharacterRelationshipListQuery = (
  value: {
    bookId?: string;
    contextAudioSeconds?: number;
    contextBookId?: string;
    contextChapter?: number;
    contextPage?: number;
    scope: RelationshipReaderScope;
  },
  ctx: z.RefinementCtx,
): void => {
  if (value.scope === "book" && value.contextBookId !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "contextBookId is not allowed with the book scope",
      path: ["contextBookId"],
    });
  }
  const isGlobalCharacterView = value.scope === "character" && value.contextBookId === undefined;
  if (value.bookId !== undefined && !isGlobalCharacterView) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "bookId is only allowed with the character scope and no contextBookId",
      path: ["bookId"],
    });
  }
  const hasSelectedBook = value.scope === "book" || value.contextBookId !== undefined;
  const positionKey = READING_POSITION_QUERY_KEYS.find((key) => value[key] !== undefined);
  if (positionKey !== undefined && !hasSelectedBook) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A reading position requires the book scope or a contextBookId",
      path: [positionKey],
    });
  }
};

export const CharacterRelationshipListQuerySchema = z
  .object({
    ...readingPositionQueryFields,
    ...paginationQueryFields({
      pageSizeDefault: CHARACTER_RELATIONSHIP_LIST_LIMITS.pageSizeDefault,
    }),
    bookId: z.uuid().optional(),
    categories: queryStringArray(RelationshipCategorySchema),
    contextBookId: z.uuid().optional(),
    intensities: queryStringArray(RelationshipIntensitySchema),
    isCanonical: z.stringbool().optional(),
    q: z
      .string()
      .transform(normalizeSearch)
      .pipe(
        z
          .string()
          .min(CHARACTER_RELATIONSHIP_LIST_LIMITS.searchMin)
          .max(CHARACTER_RELATIONSHIP_LIST_LIMITS.searchMax)
          .optional(),
      )
      .optional(),
    relationshipTypes: queryStringArray(RelationshipTypeSchema),
    scope: RelationshipReaderScopeSchema,
    scopeId: z.uuid(),
    sort: CharacterRelationshipListSortSchema.default("name_asc"),
    statuses: queryStringArray(RelationshipBookStateStatusSchema),
  })
  .superRefine(refineCharacterRelationshipListQuery);

export type CharacterRelationshipListQuery = z.infer<typeof CharacterRelationshipListQuerySchema>;

export const CharacterRelationshipListItemViewSchema = z.object({
  bookSummaries: z.array(SafeBookStateViewSchema),
  effectiveState: SafeBookStateViewSchema.nullable(),
  relationship: SafeRelationshipEdgeViewSchema,
});

export type CharacterRelationshipListItemView = z.infer<
  typeof CharacterRelationshipListItemViewSchema
>;

export const PaginatedCharacterRelationshipListViewSchema = createPaginatedSchema(
  CharacterRelationshipListItemViewSchema,
);

export type PaginatedCharacterRelationshipListView = z.infer<
  typeof PaginatedCharacterRelationshipListViewSchema
>;
