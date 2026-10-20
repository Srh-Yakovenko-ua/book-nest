import type { CharacterListSort } from "@app/shared";

import {
  type inferParserType,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { CharactersControllerListParams } from "@/shared/api/generated/model";

export const CHARACTERS_CATALOG_PAGE_SIZE = 24;

export const CHARACTERS_CATALOG_QUICK_FILTERS = [
  "all",
  "favorites",
  "multiple_books",
  "with_impression",
] as const;

export const CHARACTERS_CATALOG_SORTS = [
  "name",
  "recently_added",
  "recently_updated",
] as const satisfies readonly CharacterListSort[];

export const CHARACTERS_CATALOG_VIEWS = ["grid", "list"] as const;

export const CHARACTERS_CATALOG_SPOILER_FILTERS = ["all", "with", "without"] as const;

export type CharactersCatalogAdvancedFilters = Pick<
  CharactersCatalogState,
  keyof typeof CHARACTERS_CATALOG_ADVANCED_RESET
>;

export type CharactersCatalogQuickFilter = (typeof CHARACTERS_CATALOG_QUICK_FILTERS)[number];

export type CharactersCatalogSpoilerFilter = (typeof CHARACTERS_CATALOG_SPOILER_FILTERS)[number];

export type CharactersCatalogState = inferParserType<typeof charactersCatalogParsers>;

const idList = parseAsArrayOf(parseAsString).withDefault([]);

export const charactersCatalogParsers = {
  attitude: idList,
  bookId: parseAsString,
  filter: parseAsStringLiteral(CHARACTERS_CATALOG_QUICK_FILTERS).withDefault("all"),
  gender: idList,
  groupId: idList,
  importance: idList,
  q: parseAsString.withDefault(""),
  role: idList,
  seriesId: parseAsString,
  sort: parseAsStringLiteral(CHARACTERS_CATALOG_SORTS).withDefault("name"),
  speciesId: idList,
  spoilers: parseAsStringLiteral(CHARACTERS_CATALOG_SPOILER_FILTERS).withDefault("all"),
  tagId: idList,
  view: parseAsStringLiteral(CHARACTERS_CATALOG_VIEWS).withDefault("grid"),
};

export const CHARACTERS_CATALOG_ADVANCED_RESET = {
  attitude: null,
  bookId: null,
  gender: null,
  groupId: null,
  importance: null,
  role: null,
  seriesId: null,
  speciesId: null,
  spoilers: null,
  tagId: null,
} satisfies Partial<Record<keyof CharactersCatalogState, null>>;

export const CHARACTERS_CATALOG_ADVANCED_EMPTY = {
  attitude: [],
  bookId: null,
  gender: [],
  groupId: [],
  importance: [],
  role: [],
  seriesId: null,
  speciesId: [],
  spoilers: "all",
  tagId: [],
} satisfies CharactersCatalogAdvancedFilters;

export const CHARACTERS_CATALOG_RESET = {
  ...CHARACTERS_CATALOG_ADVANCED_RESET,
  filter: null,
  q: null,
} satisfies Partial<Record<keyof CharactersCatalogState, null>>;

export function countActiveAdvancedFilters(filters: CharactersCatalogAdvancedFilters): number {
  const lists = [
    filters.attitude,
    filters.gender,
    filters.groupId,
    filters.importance,
    filters.role,
    filters.speciesId,
    filters.tagId,
  ];
  const singles = [filters.bookId !== null, filters.seriesId !== null, filters.spoilers !== "all"];
  return (
    lists.filter((list) => list.length > 0).length + singles.filter((isActive) => isActive).length
  );
}

export function hasActiveCatalogFilters(state: CharactersCatalogState): boolean {
  return state.q.trim() !== "" || state.filter !== "all" || countActiveAdvancedFilters(state) > 0;
}

export function pickAdvancedFilters(
  state: CharactersCatalogState,
): CharactersCatalogAdvancedFilters {
  return {
    attitude: state.attitude,
    bookId: state.bookId,
    gender: state.gender,
    groupId: state.groupId,
    importance: state.importance,
    role: state.role,
    seriesId: state.seriesId,
    speciesId: state.speciesId,
    spoilers: state.spoilers,
    tagId: state.tagId,
  };
}

export function toCharactersCatalogParams(
  state: CharactersCatalogState,
): CharactersControllerListParams {
  const search = state.q.trim();

  return {
    pageSize: CHARACTERS_CATALOG_PAGE_SIZE,
    sort: state.sort,
    ...quickFilterParams(state.filter),
    ...(search === "" ? {} : { q: search }),
    ...(state.seriesId === null ? {} : { seriesId: state.seriesId }),
    ...(state.bookId === null ? {} : { bookId: state.bookId }),
    ...spoilerParams(state.spoilers),
    ...listParam("attitude", state.attitude),
    ...listParam("gender", state.gender),
    ...listParam("groupId", state.groupId),
    ...listParam("importance", state.importance),
    ...listParam("role", state.role),
    ...listParam("speciesId", state.speciesId),
    ...listParam("tagId", state.tagId),
  };
}

function listParam(
  key: "attitude" | "gender" | "groupId" | "importance" | "role" | "speciesId" | "tagId",
  values: string[],
): Partial<CharactersControllerListParams> {
  return values.length === 0 ? {} : { [key]: values };
}

function quickFilterParams(
  filter: CharactersCatalogQuickFilter,
): Partial<CharactersControllerListParams> {
  if (filter === "favorites") return { favorite: "true" };
  if (filter === "multiple_books") return { multipleBooks: "true" };
  if (filter === "with_impression") return { hasPersonalImpression: "true" };
  return {};
}

function spoilerParams(
  spoilers: CharactersCatalogSpoilerFilter,
): Partial<CharactersControllerListParams> {
  if (spoilers === "with") return { hasSpoilers: "true" };
  if (spoilers === "without") return { hasSpoilers: "false" };
  return {};
}
