import { z } from "zod";

import {
  RELATIONSHIP_CUSTOM_TYPE_MAX,
  RelationshipDirectionalitySchema,
} from "./character-relationships.js";
import { createPaginatedSchema, normalizeSearch, paginationQueryFields } from "./common.js";

export const CHARACTER_RELATIONSHIP_CUSTOM_TYPE_LIMITS = {
  nameMax: RELATIONSHIP_CUSTOM_TYPE_MAX,
  pageSizeDefault: 20,
  searchMax: RELATIONSHIP_CUSTOM_TYPE_MAX,
} as const;

export const CharacterRelationshipCustomTypesQuerySchema = z.object({
  ...paginationQueryFields({
    pageSizeDefault: CHARACTER_RELATIONSHIP_CUSTOM_TYPE_LIMITS.pageSizeDefault,
  }),
  directionality: RelationshipDirectionalitySchema.optional(),
  q: z
    .string()
    .transform(normalizeSearch)
    .pipe(z.string().max(CHARACTER_RELATIONSHIP_CUSTOM_TYPE_LIMITS.searchMax).optional())
    .optional(),
});

export type CharacterRelationshipCustomTypesQuery = z.infer<
  typeof CharacterRelationshipCustomTypesQuerySchema
>;

export const CharacterRelationshipCustomTypeViewSchema = z.object({
  directionality: RelationshipDirectionalitySchema,
  id: z.string(),
  name: z.string(),
});

export type CharacterRelationshipCustomTypeView = z.infer<
  typeof CharacterRelationshipCustomTypeViewSchema
>;

export const PaginatedCharacterRelationshipCustomTypesViewSchema = createPaginatedSchema(
  CharacterRelationshipCustomTypeViewSchema,
);

export type PaginatedCharacterRelationshipCustomTypesView = z.infer<
  typeof PaginatedCharacterRelationshipCustomTypesViewSchema
>;
