"use client";

import { useQueryState } from "nuqs";

import { characterDetailsParsers } from "./character-details-query";

export function useCharacterDetailsTab() {
  return useQueryState("tab", characterDetailsParsers.tab);
}

export function useCharacterFactsSearch() {
  return useQueryState("q", characterDetailsParsers.q);
}
