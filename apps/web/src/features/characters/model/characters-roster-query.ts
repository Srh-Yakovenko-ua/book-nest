import type { CharacterSummaryView } from "@app/shared";

import {
  type inferParserType,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import type { BookCharactersControllerListParams } from "@/shared/api/generated/model";

import { importanceRank } from "./character-options";

export const CHARACTERS_ROSTER_PAGE_SIZE = 20;
export const CHARACTERS_ROSTER_SORTS = ["recommended", "name"] as const;
export const CHARACTERS_ROSTER_SORT_DEFAULT = "recommended";

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

export function sortRosterPage(
  characters: readonly CharacterSummaryView[],
  sort: CharactersRosterSort,
): CharacterSummaryView[] {
  return [...characters].sort((left, right) => {
    if (sort === "recommended") {
      const favoriteDelta = Number(right.isFavorite) - Number(left.isFavorite);
      if (favoriteDelta !== 0) return favoriteDelta;

      const importanceDelta = importanceRank(left.importance) - importanceRank(right.importance);
      if (importanceDelta !== 0) return importanceDelta;
    }

    return rosterDisplayName(left).localeCompare(rosterDisplayName(right));
  });
}

export function toBookCharactersListParams(
  state: CharactersRosterState,
): BookCharactersControllerListParams {
  const search = state.characterSearch.trim();

  return {
    pageNumber: state.characterPage,
    pageSize: CHARACTERS_ROSTER_PAGE_SIZE,
    ...(search === "" ? {} : { search }),
  };
}
