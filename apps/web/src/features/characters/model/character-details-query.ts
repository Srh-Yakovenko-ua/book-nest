import { CHARACTER_FACT_INPUT_LIMITS, normalizeSearch } from "@app/shared";
import { parseAsString, parseAsStringLiteral } from "nuqs/server";

import type { CharacterDetailsTab } from "./character-routes";

import { CHARACTER_DETAILS_TAB_DEFAULT, CHARACTER_DETAILS_TABS } from "./character-routes";

export const characterDetailsParsers = {
  q: parseAsString.withDefault(""),
  tab: parseAsStringLiteral(CHARACTER_DETAILS_TABS).withDefault(CHARACTER_DETAILS_TAB_DEFAULT),
};

export function toCharacterDetailsTab(value: string): CharacterDetailsTab {
  return CHARACTER_DETAILS_TABS.find((tab) => tab === value) ?? CHARACTER_DETAILS_TAB_DEFAULT;
}

export function toCharacterFactsSearch(q: string): string {
  const search = normalizeSearch(q) ?? "";
  return search.length > CHARACTER_FACT_INPUT_LIMITS.searchMax ? "" : search;
}
