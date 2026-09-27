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

export type CharactersCatalogQuickFilter = (typeof CHARACTERS_CATALOG_QUICK_FILTERS)[number];

export type CharactersCatalogState = inferParserType<typeof charactersCatalogParsers>;

const idList = parseAsArrayOf(parseAsString).withDefault([]);

export const charactersCatalogParsers = {
  attitude: idList,
  filter: parseAsStringLiteral(CHARACTERS_CATALOG_QUICK_FILTERS).withDefault("all"),
  gender: idList,
  groupId: idList,
  importance: idList,
  q: parseAsString.withDefault(""),
  role: idList,
  seriesId: parseAsString,
  sort: parseAsStringLiteral(CHARACTERS_CATALOG_SORTS).withDefault("name"),
  view: parseAsStringLiteral(CHARACTERS_CATALOG_VIEWS).withDefault("grid"),
};

export const CHARACTERS_CATALOG_ADVANCED_RESET = {
  attitude: null,
  gender: null,
  groupId: null,
  importance: null,
  role: null,
  seriesId: null,
} satisfies Partial<Record<keyof CharactersCatalogState, null>>;

export const CHARACTERS_CATALOG_RESET = {
  ...CHARACTERS_CATALOG_ADVANCED_RESET,
  filter: null,
  q: null,
} satisfies Partial<Record<keyof CharactersCatalogState, null>>;

export function countActiveAdvancedFilters(state: CharactersCatalogState): number {
  const lists = [state.attitude, state.gender, state.groupId, state.importance, state.role];
  return lists.filter((list) => list.length > 0).length + (state.seriesId === null ? 0 : 1);
}

export function hasActiveCatalogFilters(state: CharactersCatalogState): boolean {
  return state.q.trim() !== "" || state.filter !== "all" || countActiveAdvancedFilters(state) > 0;
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
    ...listParam("attitude", state.attitude),
    ...listParam("gender", state.gender),
    ...listParam("groupId", state.groupId),
    ...listParam("importance", state.importance),
    ...listParam("role", state.role),
  };
}

function listParam(
  key: "attitude" | "gender" | "groupId" | "importance" | "role",
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
