import { z } from "zod";

import { RELATIONSHIP_LABEL_MAX } from "./character-relationships.js";
import { createPaginatedSchema, normalizeSearch, paginationQueryFields } from "./common.js";

export const CHARACTER_RELATIONSHIP_ROLE_SUGGESTION_LIMITS = {
  labelMax: RELATIONSHIP_LABEL_MAX,
  pageSizeDefault: 20,
  searchMax: RELATIONSHIP_LABEL_MAX,
} as const;

export const CharacterRelationshipRoleSuggestionsQuerySchema = z.object({
  ...paginationQueryFields({
    pageSizeDefault: CHARACTER_RELATIONSHIP_ROLE_SUGGESTION_LIMITS.pageSizeDefault,
  }),
  q: z
    .string()
    .transform(normalizeSearch)
    .pipe(z.string().max(CHARACTER_RELATIONSHIP_ROLE_SUGGESTION_LIMITS.searchMax).optional())
    .optional(),
});

export type CharacterRelationshipRoleSuggestionsQuery = z.infer<
  typeof CharacterRelationshipRoleSuggestionsQuerySchema
>;

export const CharacterRelationshipRoleSuggestionViewSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export type CharacterRelationshipRoleSuggestionView = z.infer<
  typeof CharacterRelationshipRoleSuggestionViewSchema
>;

export const PaginatedCharacterRelationshipRoleSuggestionsViewSchema = createPaginatedSchema(
  CharacterRelationshipRoleSuggestionViewSchema,
);

export type PaginatedCharacterRelationshipRoleSuggestionsView = z.infer<
  typeof PaginatedCharacterRelationshipRoleSuggestionsViewSchema
>;
