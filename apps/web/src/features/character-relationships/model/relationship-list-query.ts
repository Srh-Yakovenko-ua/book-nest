import {
  CHARACTER_RELATIONSHIP_LIST_LIMITS,
  CharacterRelationshipListSortSchema,
  normalizeSearch,
  RelationshipBookStateStatusSchema,
  RelationshipCategorySchema,
  RelationshipIntensitySchema,
  RelationshipTypeSchema,
} from "@app/shared";
import {
  createParser,
  type inferParserType,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { z } from "zod";

import type { CharacterRelationshipsControllerListParams } from "@/shared/api/generated/model";

import type { RelationshipScope } from "./relationship-scope";

import { isGlobalCharacterScope } from "./relationship-scope";

const RelationshipBookIdSchema = z.uuid();

export const RELATIONSHIP_LIST_QUERY = {
  canonicalValues: ["true", "false"],
  sortDefault: "name_asc",
  sortOptions: CharacterRelationshipListSortSchema.options,
} as const;

export const RELATIONSHIP_LIST_PARSERS = {
  relBook: createParser({
    parse: (value: string) => RelationshipBookIdSchema.safeParse(value).data ?? null,
    serialize: (value: string) => value,
  }),
  relCanon: parseAsStringLiteral(RELATIONSHIP_LIST_QUERY.canonicalValues),
  relCat: parseAsArrayOf(parseAsStringLiteral(RelationshipCategorySchema.options)).withDefault([]),
  relIntensity: parseAsArrayOf(
    parseAsStringLiteral(RelationshipIntensitySchema.options),
  ).withDefault([]),
  relQ: parseAsString.withDefault(""),
  relSort: parseAsStringLiteral(RELATIONSHIP_LIST_QUERY.sortOptions).withDefault(
    RELATIONSHIP_LIST_QUERY.sortDefault,
  ),
  relStatus: parseAsArrayOf(
    parseAsStringLiteral(RelationshipBookStateStatusSchema.options),
  ).withDefault([]),
  relType: parseAsArrayOf(parseAsStringLiteral(RelationshipTypeSchema.options)).withDefault([]),
};

export type RelationshipAdvancedFilters = Pick<
  RelationshipListQueryState,
  "relBook" | "relCanon" | "relIntensity" | "relStatus" | "relType"
>;

export type RelationshipCanonicalFilter = (typeof RELATIONSHIP_LIST_QUERY.canonicalValues)[number];

export type RelationshipListCriteria = Omit<
  CharacterRelationshipsControllerListParams,
  "contextBookId" | "pageNumber" | "pageSize" | "scope" | "scopeId"
>;

export type RelationshipListQueryState = inferParserType<typeof RELATIONSHIP_LIST_PARSERS>;

export type RelationshipListSort = (typeof RELATIONSHIP_LIST_QUERY.sortOptions)[number];

type RelationshipListResetPatch = Record<keyof RelationshipListQueryState, null>;

export const RELATIONSHIP_LIST_RESET = {
  advanced: {
    relBook: null,
    relCanon: null,
    relIntensity: [],
    relStatus: [],
    relType: [],
  },
  all: {
    relBook: null,
    relCanon: null,
    relCat: null,
    relIntensity: null,
    relQ: null,
    relSort: null,
    relStatus: null,
    relType: null,
  },
} satisfies {
  advanced: RelationshipAdvancedFilters;
  all: RelationshipListResetPatch;
};

export function countRelationshipAdvancedFilters(filters: RelationshipAdvancedFilters): number {
  return [
    filters.relBook !== null,
    filters.relCanon !== null,
    filters.relIntensity.length > 0,
    filters.relStatus.length > 0,
    filters.relType.length > 0,
  ].filter(Boolean).length;
}

export function hasActiveRelationshipCriteria(state: RelationshipListQueryState): boolean {
  return (
    toRelationshipSearch(state.relQ) !== "" ||
    state.relCat.length > 0 ||
    countRelationshipAdvancedFilters(state) > 0
  );
}

export function hasRelationshipListState(state: RelationshipListQueryState): boolean {
  return (
    state.relQ !== "" ||
    state.relSort !== RELATIONSHIP_LIST_QUERY.sortDefault ||
    state.relCat.length > 0 ||
    countRelationshipAdvancedFilters(state) > 0
  );
}

export function isRelationshipSearchTooShort(query: string): boolean {
  const search = normalizeSearch(query) ?? "";
  return search.length > 0 && search.length < CHARACTER_RELATIONSHIP_LIST_LIMITS.searchMin;
}

export function toRelationshipAdvancedFilters(
  state: RelationshipListQueryState,
): RelationshipAdvancedFilters {
  return {
    relBook: state.relBook,
    relCanon: state.relCanon,
    relIntensity: state.relIntensity,
    relStatus: state.relStatus,
    relType: state.relType,
  };
}

export function toRelationshipListCriteria(
  state: RelationshipListQueryState,
): RelationshipListCriteria {
  const search = toRelationshipSearch(state.relQ);

  return {
    sort: state.relSort,
    ...(search === "" ? {} : { q: search }),
    ...(state.relCat.length === 0 ? {} : { categories: state.relCat }),
    ...(state.relType.length === 0 ? {} : { relationshipTypes: state.relType }),
    ...(state.relStatus.length === 0 ? {} : { statuses: state.relStatus }),
    ...(state.relIntensity.length === 0 ? {} : { intensities: state.relIntensity }),
    ...(state.relCanon === null ? {} : { isCanonical: state.relCanon }),
    ...(state.relBook === null ? {} : { bookId: state.relBook }),
  };
}

export function toRelationshipListSort(value: string): RelationshipListSort {
  return (
    RELATIONSHIP_LIST_QUERY.sortOptions.find((option) => option === value) ??
    RELATIONSHIP_LIST_QUERY.sortDefault
  );
}

export function toRelationshipSearch(query: string): string {
  const search = normalizeSearch(query) ?? "";
  const isCommittable =
    search.length >= CHARACTER_RELATIONSHIP_LIST_LIMITS.searchMin &&
    search.length <= CHARACTER_RELATIONSHIP_LIST_LIMITS.searchMax;
  return isCommittable ? search : "";
}

export function toScopedRelationshipListState({
  scope,
  state,
}: {
  scope: RelationshipScope;
  state: RelationshipListQueryState;
}): RelationshipListQueryState {
  return isGlobalCharacterScope(scope) ? state : { ...state, relBook: null };
}
