"use client";

import { useQueryState } from "nuqs";

import { CHARACTERS_VIEW } from "./characters-view-mode";

export function useCharactersViewMode() {
  return useQueryState(CHARACTERS_VIEW.urlKey, CHARACTERS_VIEW.parser);
}
