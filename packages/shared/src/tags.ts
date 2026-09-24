import { z } from "zod";

import {
  collapseSpaces,
  createPaginatedSchema,
  normalizeName,
  type Nullable,
  paginationQueryFields,
} from "./common.js";
import { CountSchema, NoHtmlString, queryStringArray } from "./internal.js";

export const TAG_NAME_MIN = 2;
export const TAG_NAME_MAX = 40;
export const TAG_DESCRIPTION_MAX = 300;
const BOOK_TAGS_MAX = 15;
const TAG_SEARCH_MAX = 100;
const TAGS_CATALOG_PAGE_NUMBER_MAX = 1000;

export const TAGS_PAGE_SIZE = 20;

export const TAG_SUMMARY_RULES = {
  leadersLimit: 2,
} as const;

export const TAG_NAME_ALLOWED_CHARS = /^[\p{L}\p{N} '’-]+$/u;

export const TagTypeSchema = z.enum([
  "trope",
  "atmosphere",
  "theme",
  "character",
  "format",
  "custom",
]);

export type TagType = z.infer<typeof TagTypeSchema>;

export const DEFAULT_TAG_TYPE: TagType = "custom";

export const TagNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(
    NoHtmlString.min(TAG_NAME_MIN, "Tag must be at least 2 characters long")
      .max(TAG_NAME_MAX, "Tag must be at most 40 characters long")
      .regex(
        TAG_NAME_ALLOWED_CHARS,
        "Tag may contain only letters, digits, spaces, hyphens and apostrophes",
      ),
  );

export const TAG_COLORS = [
  "parchment",
  "terracotta",
  "honey",
  "sage",
  "forest",
  "sky",
  "lavender",
  "rose",
] as const;

export const TagColorSchema = z.enum(TAG_COLORS);

export type TagColor = z.infer<typeof TagColorSchema>;

export const TAG_COLOR_DEFAULT = "parchment" satisfies TagColor;

export function resolveTagColor(color: Nullable<string>): TagColor {
  const parsed = TagColorSchema.safeParse(color);
  return parsed.success ? parsed.data : TAG_COLOR_DEFAULT;
}

export const TagDescriptionSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(NoHtmlString.max(TAG_DESCRIPTION_MAX, "Description must be at most 300 characters long"));

export const CreateTagSchema = z.object({
  color: TagColorSchema.optional(),
  description: TagDescriptionSchema.optional(),
  name: TagNameSchema,
  type: TagTypeSchema.default(DEFAULT_TAG_TYPE),
});

export type CreateTagInput = z.infer<typeof CreateTagSchema>;

export const UpdateTagSchema = z
  .object({
    color: TagColorSchema.nullable(),
    description: TagDescriptionSchema.nullable(),
    name: TagNameSchema,
    type: TagTypeSchema,
  })
  .partial()
  .refine((input) => Object.values(input).some((value) => value !== undefined), {
    message: "At least one field must be provided",
  });

export type UpdateTagInput = z.infer<typeof UpdateTagSchema>;

export const BookTagsInputSchema = z
  .array(TagNameSchema)
  .max(BOOK_TAGS_MAX, "You can add at most 15 tags")
  .refine((tags) => {
    const seen = new Set(tags.map(normalizeName));
    return seen.size === tags.length;
  }, "Tags must not contain duplicates");

export const TagViewSchema = z.object({
  color: TagColorSchema.describe(
    "Effective palette color; a missing or legacy color reads as parchment.",
  ),
  id: z.string(),
  name: z.string(),
});

export type TagView = z.infer<typeof TagViewSchema>;

export type TagViewSource = { color: Nullable<string>; id: string; name: string };

export function toTagView(tag: TagViewSource): TagView {
  return { color: resolveTagColor(tag.color), id: tag.id, name: tag.name };
}

export const TagCatalogViewSchema = z.object({
  color: z.string().nullable(),
  createdAt: z.string(),
  description: z.string().nullable(),
  id: z.string(),
  lastUsedAt: z.string().nullable(),
  name: z.string(),
  normalizedName: z.string(),
  type: TagTypeSchema,
  updatedAt: z.string(),
});

export type TagCatalogView = z.infer<typeof TagCatalogViewSchema>;

export const TagQuickFilterSchema = z.enum(["all", "used", "books", "characters", "unused"]);

export type TagQuickFilter = z.infer<typeof TagQuickFilterSchema>;

export const TAG_QUICK_FILTER_DEFAULT = "all" satisfies TagQuickFilter;

export const TagSortSchema = z.enum([
  "usage_count_desc",
  "books_count_desc",
  "characters_count_desc",
  "name_asc",
  "type_asc",
  "created_desc",
]);

export type TagSort = z.infer<typeof TagSortSchema>;

export const TAG_SORT_DEFAULT = "usage_count_desc" satisfies TagSort;

const blankToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim().length === 0 ? undefined : value;

const tagsDatasetQueryFields = {
  color: queryStringArray(TagColorSchema),
  q: z.preprocess(blankToUndefined, z.string().trim().max(TAG_SEARCH_MAX).optional()),
  type: queryStringArray(TagTypeSchema),
};

export const TagsCatalogQuerySchema = z.object({
  ...tagsDatasetQueryFields,
  filter: TagQuickFilterSchema.default(TAG_QUICK_FILTER_DEFAULT),
  ...paginationQueryFields({
    pageNumberMax: TAGS_CATALOG_PAGE_NUMBER_MAX,
    pageSizeDefault: TAGS_PAGE_SIZE,
  }),
  sort: TagSortSchema.default(TAG_SORT_DEFAULT),
});

export type TagsCatalogQuery = z.infer<typeof TagsCatalogQuerySchema>;

export const TagsCatalogFacetsQuerySchema = z.object(tagsDatasetQueryFields);

export type TagsCatalogFacetsQuery = z.infer<typeof TagsCatalogFacetsQuerySchema>;

export const TagCatalogListItemSchema = z.object({
  booksCount: CountSchema,
  charactersCount: CountSchema,
  color: TagColorSchema.describe(
    "Effective palette color; a missing or legacy color reads as parchment.",
  ),
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  type: TagTypeSchema,
  usageCount: CountSchema.describe("booksCount + charactersCount"),
});

export type TagCatalogListItem = z.infer<typeof TagCatalogListItemSchema>;

export const PaginatedTagCatalogSchema = createPaginatedSchema(TagCatalogListItemSchema);

export type PaginatedTagCatalog = z.infer<typeof PaginatedTagCatalogSchema>;

export const TagQuickCountsSchema = z.object({
  all: CountSchema,
  books: CountSchema,
  characters: CountSchema,
  unused: CountSchema,
  used: CountSchema,
});

export type TagQuickCounts = z.infer<typeof TagQuickCountsSchema>;

export const TagsCatalogFacetsViewSchema = z.object({
  quickCounts: TagQuickCountsSchema.describe(
    "Quick-filter counts under the committed search, type and color; books and characters may overlap.",
  ),
});

export type TagsCatalogFacetsView = z.infer<typeof TagsCatalogFacetsViewSchema>;

export const TagsMostUsedLeaderSchema = z.object({
  booksCount: CountSchema,
  charactersCount: CountSchema,
  id: z.string(),
  name: z.string(),
});

export type TagsMostUsedLeader = z.infer<typeof TagsMostUsedLeaderSchema>;

export const TagsMostUsedSummarySchema = z.object({
  leaders: z
    .array(TagsMostUsedLeaderSchema)
    .max(TAG_SUMMARY_RULES.leadersLimit)
    .describe("At most two tied leaders ordered by name, then id."),
  leadersCount: z.number().int().positive().describe("Total number of tied leaders."),
  usageCount: CountSchema,
});

export type TagsMostUsedSummary = z.infer<typeof TagsMostUsedSummarySchema>;

export const TagUsageDistributionSchema = z.object({
  booksOnly: CountSchema,
  both: CountSchema,
  charactersOnly: CountSchema,
  unused: CountSchema,
});

export type TagUsageDistribution = z.infer<typeof TagUsageDistributionSchema>;

export const TagTypeCountsSchema = z.record(TagTypeSchema, CountSchema);

export type TagTypeCounts = z.infer<typeof TagTypeCountsSchema>;

export const TagColorCountsSchema = z.record(TagColorSchema, CountSchema);

export type TagColorCounts = z.infer<typeof TagColorCountsSchema>;

export const TagsSummaryViewSchema = z.object({
  colorCounts: TagColorCountsSchema,
  mostUsed: TagsMostUsedSummarySchema.nullable(),
  taggedBooksCount: CountSchema,
  taggedCharactersCount: CountSchema,
  totalBooksCount: CountSchema,
  totalCharactersCount: CountSchema,
  totalTagsCount: CountSchema,
  typeCounts: TagTypeCountsSchema,
  usageDistribution: TagUsageDistributionSchema,
});

export type TagsSummaryView = z.infer<typeof TagsSummaryViewSchema>;

export const TagDeletionPreviewViewSchema = z.object({
  bookLinksCount: CountSchema,
  characterLinksCount: CountSchema,
});

export type TagDeletionPreviewView = z.infer<typeof TagDeletionPreviewViewSchema>;
