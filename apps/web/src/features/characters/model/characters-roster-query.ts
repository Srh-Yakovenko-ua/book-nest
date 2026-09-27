import type {
  BookCharacterSummaryQuery,
  BookView,
  CharacterSummaryView,
  ReadingStatus,
} from "@app/shared";

import {
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { BookCharactersControllerListParams } from "@/shared/api/generated/model";

export const CHARACTERS_ROSTER_PAGE_SIZE = 20;
export const CHARACTERS_ROSTER_SORTS = ["importance", "name"] as const;
export const CHARACTERS_ROSTER_SORT_DEFAULT = "importance";

const FULLY_READ_STATUSES = ["finished", "dnf"] as const satisfies readonly ReadingStatus[];

export type CharactersRosterSort = (typeof CHARACTERS_ROSTER_SORTS)[number];

export const charactersRosterParsers = {
  characterPage: parseAsInteger.withDefault(1),
  characterSearch: parseAsString.withDefault(""),
  characterSort: parseAsStringLiteral(CHARACTERS_ROSTER_SORTS).withDefault(
    CHARACTERS_ROSTER_SORT_DEFAULT,
  ),
};

export type CharactersRosterState = inferParserType<typeof charactersRosterParsers>;

export const CHARACTERS_ROSTER_RESET = {
  characterPage: null,
  characterSearch: null,
  characterSort: null,
} satisfies Partial<Record<keyof CharactersRosterState, null>>;

export function hasActiveRosterSearch(state: CharactersRosterState): boolean {
  return state.characterSearch.trim() !== "";
}

export function rosterDisplayName(character: CharacterSummaryView): string {
  return character.displayName ?? character.name;
}

export function toBookCharactersListParams(
  state: CharactersRosterState,
  readingContext: BookCharacterSummaryQuery,
): BookCharactersControllerListParams {
  const search = state.characterSearch.trim();

  return {
    pageNumber: state.characterPage,
    pageSize: CHARACTERS_ROSTER_PAGE_SIZE,
    sort: state.characterSort,
    ...readingContext,
    ...(search === "" ? {} : { search }),
  };
}

export function toCharacterReadingContext(book: BookView): BookCharacterSummaryQuery {
  if (FULLY_READ_STATUSES.some((status) => status === book.readingStatus)) return {};

  const currentPage = book.readingProgress?.currentPage ?? null;
  if (currentPage === null || !Number.isInteger(currentPage) || currentPage <= 0) return {};

  return { contextBookId: book.id, contextPage: currentPage };
}
