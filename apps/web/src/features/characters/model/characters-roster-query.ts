import type {
  BookCharacterImportance,
  BookCharacterSummaryQuery,
  BookView,
  CharacterSummaryView,
  ReadingStatus,
} from "@app/shared";

import { BookCharacterImportanceSchema } from "@app/shared";
import {
  type inferParserType,
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { BookCharactersControllerListParams } from "@/shared/api/generated/model";

import {
  BookCharactersControllerListFavoritesOnly,
  BookCharactersControllerListPovOnly,
} from "@/shared/api/generated/model";

export const CHARACTERS_ROSTER_PAGE_SIZE = 20;
export const CHARACTERS_ROSTER_SORTS = ["importance", "name"] as const;
export const CHARACTERS_ROSTER_SORT_DEFAULT = "importance";
export const CHARACTERS_ROSTER_FILTERS = ["all", "favorites", "pov"] as const;
export const CHARACTERS_ROSTER_FILTER_DEFAULT = "all";

const FULLY_READ_STATUSES = ["finished", "dnf"] as const satisfies readonly ReadingStatus[];

export type CharactersRosterFilter = (typeof CHARACTERS_ROSTER_FILTERS)[number];
export type CharactersRosterSort = (typeof CHARACTERS_ROSTER_SORTS)[number];

const ROSTER_FILTER_LIST_PARAMS = {
  all: {},
  favorites: { favoritesOnly: BookCharactersControllerListFavoritesOnly.true },
  pov: { povOnly: BookCharactersControllerListPovOnly.true },
} as const satisfies Record<CharactersRosterFilter, Partial<BookCharactersControllerListParams>>;

export const charactersRosterParsers = {
  characterFilter: parseAsStringLiteral(CHARACTERS_ROSTER_FILTERS).withDefault(
    CHARACTERS_ROSTER_FILTER_DEFAULT,
  ),
  characterImportance: parseAsArrayOf(
    parseAsStringLiteral(BookCharacterImportanceSchema.options),
  ).withDefault([]),
  characterSearch: parseAsString.withDefault(""),
  characterSort: parseAsStringLiteral(CHARACTERS_ROSTER_SORTS).withDefault(
    CHARACTERS_ROSTER_SORT_DEFAULT,
  ),
};

export type CharactersRosterState = inferParserType<typeof charactersRosterParsers>;

export const CHARACTERS_ROSTER_RESET = {
  filters: { characterFilter: null, characterImportance: null },
  search: { characterSearch: null },
} satisfies Record<string, Partial<Record<keyof CharactersRosterState, null>>>;

export function canonicalRosterImportance(
  selected: readonly BookCharacterImportance[],
): BookCharacterImportance[] {
  return BookCharacterImportanceSchema.options.filter((option) => selected.includes(option));
}

export function hasActiveRosterFilters(state: CharactersRosterState): boolean {
  return (
    state.characterImportance.length > 0 ||
    state.characterFilter !== CHARACTERS_ROSTER_FILTER_DEFAULT
  );
}

export function hasActiveRosterSearch(state: CharactersRosterState): boolean {
  return state.characterSearch.trim() !== "";
}

export function rosterDisplayName(character: CharacterSummaryView): string {
  return character.displayName ?? character.name;
}

export function rosterDistinctGlobalName({
  displayName,
  name,
}: CharacterSummaryView): string | undefined {
  return displayName !== null && displayName !== name ? name : undefined;
}

export function toBookCharactersListParams(
  state: CharactersRosterState,
  bookContext: BookCharacterSummaryQuery,
): BookCharactersControllerListParams {
  const search = state.characterSearch.trim();
  const importance = canonicalRosterImportance(state.characterImportance);

  return {
    pageSize: CHARACTERS_ROSTER_PAGE_SIZE,
    sort: state.characterSort,
    ...bookContext,
    ...(search === "" ? {} : { search }),
    ...(importance.length === 0 ? {} : { importance }),
    ...ROSTER_FILTER_LIST_PARAMS[state.characterFilter],
  };
}

export function toCharacterBookContext(book: BookView): BookCharacterSummaryQuery {
  if (FULLY_READ_STATUSES.some((status) => status === book.readingStatus)) return {};

  const currentPage = book.readingProgress?.currentPage ?? null;
  if (currentPage === null || !Number.isInteger(currentPage) || currentPage <= 0) return {};

  return { contextBookId: book.id };
}
