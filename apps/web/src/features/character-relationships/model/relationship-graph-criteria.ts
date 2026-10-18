import {
  CHARACTER_GRAPH_DEPTH_DEFAULT,
  CHARACTER_GRAPH_DEPTH_MAX,
  CHARACTER_GRAPH_DEPTH_MIN,
  type CharacterGraphClusterBy,
  type CharacterGraphMode,
  type Nullable,
  RELATIONSHIP_CATEGORY_TYPES,
  type RelationshipCategory,
  RelationshipCategorySchema,
  type RelationshipType,
} from "@app/shared";

import type { BookCharacterGraphControllerGetParams } from "@/shared/api/generated/model";

export type RelationshipGraphCriteria = {
  categories: RelationshipCategory[];
  clusterBy: Nullable<CharacterGraphClusterBy>;
  depth: number;
  focusCharacterId: Nullable<string>;
  mode: CharacterGraphMode;
  relationshipTypes: RelationshipType[];
};

export type RelationshipGraphFilters = Pick<
  RelationshipGraphCriteria,
  "categories" | "mode" | "relationshipTypes"
>;

export const RELATIONSHIP_GRAPH_CRITERIA = {
  defaults: {
    categories: [],
    clusterBy: null,
    depth: CHARACTER_GRAPH_DEPTH_DEFAULT,
    focusCharacterId: null,
    mode: "all",
    relationshipTypes: [],
  },
  depthOptions: Array.from(
    { length: CHARACTER_GRAPH_DEPTH_MAX - CHARACTER_GRAPH_DEPTH_MIN + 1 },
    (_, index) => CHARACTER_GRAPH_DEPTH_MIN + index,
  ),
  familyCategory: "family",
} satisfies {
  defaults: RelationshipGraphCriteria;
  depthOptions: readonly number[];
  familyCategory: RelationshipCategory;
};

export function clearRelationshipGraphFilters(
  criteria: RelationshipGraphCriteria,
): RelationshipGraphCriteria {
  return {
    ...criteria,
    categories: [],
    depth: RELATIONSHIP_GRAPH_CRITERIA.defaults.depth,
    focusCharacterId: null,
    relationshipTypes: [],
  };
}

export function hasRelationshipGraphFilters(criteria: RelationshipGraphCriteria): boolean {
  return (
    criteria.categories.length > 0 ||
    criteria.relationshipTypes.length > 0 ||
    criteria.focusCharacterId !== null
  );
}

export function toRelationshipGraphCategoryOptions(
  mode: CharacterGraphMode,
): RelationshipCategory[] {
  return mode === "family"
    ? [RELATIONSHIP_GRAPH_CRITERIA.familyCategory]
    : RelationshipCategorySchema.options;
}

export function toRelationshipGraphFilterParams({
  categories,
  mode,
  relationshipTypes,
}: RelationshipGraphFilters) {
  return {
    mode,
    ...(categories.length === 0 ? {} : { categories }),
    ...(relationshipTypes.length === 0 ? {} : { relationshipTypes }),
  };
}

export function toRelationshipGraphParams(
  criteria: RelationshipGraphCriteria,
): BookCharacterGraphControllerGetParams {
  return {
    ...toRelationshipGraphFilterParams(criteria),
    ...(criteria.clusterBy === null ? {} : { clusterBy: criteria.clusterBy }),
    ...(criteria.focusCharacterId === null
      ? {}
      : { depth: criteria.depth, focusCharacterId: criteria.focusCharacterId }),
  };
}

export function toRelationshipGraphTypeOptions(mode: CharacterGraphMode): RelationshipType[] {
  return toRelationshipGraphCategoryOptions(mode).flatMap(
    (category) => RELATIONSHIP_CATEGORY_TYPES[category],
  );
}

export function withRelationshipGraphMode({
  criteria,
  mode,
}: {
  criteria: RelationshipGraphCriteria;
  mode: CharacterGraphMode;
}): RelationshipGraphCriteria {
  return { ...criteria, categories: [], mode, relationshipTypes: [] };
}
