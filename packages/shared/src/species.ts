import { z } from "zod";

import { collapseSpaces } from "./common.js";
import { CountSchema, NoHtmlString } from "./internal.js";
import { CatalogLocaleSchema } from "./taxonomy.js";

export const SPECIES_SEARCH = {
  debounceMs: 300,
  maxResults: 10,
  minQueryLength: 2,
  nameMax: 120,
} as const;

export const SPECIES_ERROR_CODES = {
  duplicate: "species_duplicate",
  forbidden: "species_forbidden",
  inUse: "species_in_use",
  mergeConflict: "species_merge_conflict",
  mergeInvalidTarget: "species_merge_invalid_target",
  mergeSelf: "species_merge_self",
  notFound: "species_not_found",
} as const;

const SpeciesNameSchema = z
  .string()
  .transform(collapseSpaces)
  .pipe(NoHtmlString.min(1).max(SPECIES_SEARCH.nameMax));

export const SpeciesLabelsSchema = z.object({
  en: z.string(),
  uk: z.string(),
});

export type SpeciesLabels = z.infer<typeof SpeciesLabelsSchema>;

export const SpeciesRefViewSchema = z.object({
  id: z.string().uuid(),
  key: z.string().nullable(),
  labels: SpeciesLabelsSchema,
});

export type SpeciesRefView = z.infer<typeof SpeciesRefViewSchema>;

export const SpeciesCategoryViewSchema = z.object({
  key: z.string(),
  name: z.string(),
});

export type SpeciesCategoryView = z.infer<typeof SpeciesCategoryViewSchema>;

export const SpeciesOptionViewSchema = z.object({
  category: SpeciesCategoryViewSchema.nullable(),
  id: z.string().uuid(),
  isOwn: z.boolean(),
  key: z.string().nullable(),
  name: z.string(),
});

export type SpeciesOptionView = z.infer<typeof SpeciesOptionViewSchema>;

export const SpeciesLocaleQuerySchema = z.object({
  locale: CatalogLocaleSchema.default("uk"),
});

export type SpeciesLocaleQuery = z.infer<typeof SpeciesLocaleQuerySchema>;

export const SpeciesSearchQuerySchema = SpeciesLocaleQuerySchema.extend({
  q: z.string().trim().max(SPECIES_SEARCH.nameMax).optional(),
});

export type SpeciesSearchQuery = z.infer<typeof SpeciesSearchQuerySchema>;

export const SpeciesSearchResultSchema = z.object({
  items: z.array(SpeciesOptionViewSchema),
});

export type SpeciesSearchResult = z.infer<typeof SpeciesSearchResultSchema>;

export const SpeciesCandidatesQuerySchema = SpeciesLocaleQuerySchema.extend({
  name: SpeciesNameSchema,
});

export type SpeciesCandidatesQuery = z.infer<typeof SpeciesCandidatesQuerySchema>;

export const SpeciesCandidatesSchema = z.object({
  exact: SpeciesOptionViewSchema.nullable(),
  similar: z.array(SpeciesOptionViewSchema),
});

export type SpeciesCandidates = z.infer<typeof SpeciesCandidatesSchema>;

export const SpeciesUsageSchema = z.object({
  bookOverrides: CountSchema,
  characters: CountSchema,
  trashed: CountSchema,
});

export type SpeciesUsage = z.infer<typeof SpeciesUsageSchema>;

export const OwnSpeciesViewSchema = SpeciesOptionViewSchema.extend({
  usage: SpeciesUsageSchema,
});

export type OwnSpeciesView = z.infer<typeof OwnSpeciesViewSchema>;

export const OwnSpeciesListSchema = z.object({
  items: z.array(OwnSpeciesViewSchema),
});

export type OwnSpeciesList = z.infer<typeof OwnSpeciesListSchema>;

export const SpeciesNameInputSchema = z
  .object({
    name: SpeciesNameSchema,
  })
  .strict();

export type SpeciesNameInput = z.infer<typeof SpeciesNameInputSchema>;

export const SpeciesDeletionPreviewSchema = SpeciesUsageSchema.extend({
  canDelete: z.boolean(),
});

export type SpeciesDeletionPreview = z.infer<typeof SpeciesDeletionPreviewSchema>;

export const MergeSpeciesInputSchema = z
  .object({
    targetId: z.string().uuid(),
  })
  .strict();

export type MergeSpeciesInput = z.infer<typeof MergeSpeciesInputSchema>;

export const SpeciesMergeResultSchema = z.object({
  reassigned: z.object({
    bookOverrides: CountSchema,
    characters: CountSchema,
  }),
  target: SpeciesOptionViewSchema,
});

export type SpeciesMergeResult = z.infer<typeof SpeciesMergeResultSchema>;
