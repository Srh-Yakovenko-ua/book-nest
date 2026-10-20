import type { CharacterListSort } from "@app/shared";

import {
  BookCharacterImportanceSchema,
  BookCharacterRoleTypeSchema,
  CharacterAttitudeSchema,
  CharacterGenderSchema,
} from "@app/shared";
import {
  type inferParserType,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import { z } from "zod";

import type { CharactersControllerListParams } from "@/shared/api/generated/model";

import { parseAsSchema } from "@/lib/parse-as-schema";

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

type CharactersCatalogFilterParams = Omit<
  CharactersControllerListParams,
  "pageNumber" | "pageSize" | "sort"
>;

const uuidParser = parseAsSchema(z.uuid());

const uuidListParser = parseAsArrayOf(uuidParser).withDefault([]);

export const charactersCatalogParsers = {
  attitude: parseAsArrayOf(parseAsStringLiteral(CharacterAttitudeSchema.options)).withDefault([]),
  bookId: uuidParser,
  filter: parseAsStringLiteral(CHARACTERS_CATALOG_QUICK_FILTERS).withDefault("all"),
  gender: parseAsArrayOf(parseAsStringLiteral(CharacterGenderSchema.options)).withDefault([]),
  groupId: uuidListParser,
  importance: parseAsArrayOf(
    parseAsStringLiteral(BookCharacterImportanceSchema.options),
  ).withDefault([]),
  q: parseAsString.withDefault(""),
  role: parseAsArrayOf(parseAsStringLiteral(BookCharacterRoleTypeSchema.options)).withDefault([]),
  seriesId: uuidParser,
  sort: parseAsStringLiteral(CHARACTERS_CATALOG_SORTS).withDefault("name"),
  speciesId: uuidListParser,
  spoilers: parseAsStringLiteral(CHARACTERS_CATALOG_SPOILER_FILTERS).withDefault("all"),
  tagId: uuidListParser,
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

export function toCharactersCatalogFilterParams(
  state: Omit<CharactersCatalogState, "sort" | "view">,
): CharactersCatalogFilterParams {
  const search = state.q.trim();

  return {
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

export function toCharactersCatalogParams(
  state: CharactersCatalogState,
): CharactersControllerListParams {
  return {
    pageSize: CHARACTERS_CATALOG_PAGE_SIZE,
    sort: state.sort,
    ...toCharactersCatalogFilterParams(state),
  };
}

function listParam(
  key: "attitude" | "gender" | "groupId" | "importance" | "role" | "speciesId" | "tagId",
  values: string[],
): CharactersCatalogFilterParams {
  return values.length === 0 ? {} : { [key]: [...new Set(values)].sort() };
}

function quickFilterParams(filter: CharactersCatalogQuickFilter): CharactersCatalogFilterParams {
  if (filter === "favorites") return { favorite: "true" };
  if (filter === "multiple_books") return { multipleBooks: "true" };
  if (filter === "with_impression") return { hasPersonalImpression: "true" };
  return {};
}

function spoilerParams(spoilers: CharactersCatalogSpoilerFilter): CharactersCatalogFilterParams {
  if (spoilers === "with") return { hasSpoilers: "true" };
  if (spoilers === "without") return { hasSpoilers: "false" };
  return {};
}
