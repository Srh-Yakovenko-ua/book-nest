"use client";

import type { BookCharacterImportance } from "@app/shared";

import { useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";

import type { CharactersRosterFilter, CharactersRosterState } from "./characters-roster-query";

import { CHARACTERS_ROSTER_FILTER_DEFAULT } from "./characters-roster-query";

type UseCharactersRosterFilterChipsOptions = {
  onFilterChange: (value: CharactersRosterFilter) => void;
  onImportanceChange: (value: readonly BookCharacterImportance[]) => void;
  onSearch: (value: string) => void;
  state: CharactersRosterState;
};

export function useCharactersRosterFilterChips({
  onFilterChange,
  onImportanceChange,
  onSearch,
  state,
}: UseCharactersRosterFilterChipsOptions): ActiveFilterChip[] {
  const t = useTranslations("characters.activeFilters");
  const tQuick = useTranslations("characters.toolbar.quick");
  const tImportance = useTranslations("characters.importance");

  const chips: ActiveFilterChip[] = [];

  const search = state.characterSearch.trim();
  if (search !== "") {
    chips.push({
      key: "characterSearch",
      label: t("search", { query: search }),
      onRemove: () => onSearch(""),
    });
  }

  if (state.characterFilter !== CHARACTERS_ROSTER_FILTER_DEFAULT) {
    chips.push({
      key: "characterFilter",
      label: tQuick(state.characterFilter),
      onRemove: () => onFilterChange(CHARACTERS_ROSTER_FILTER_DEFAULT),
    });
  }

  for (const value of state.characterImportance) {
    chips.push({
      key: `characterImportance:${value}`,
      label: t("importance", { label: tImportance(value) }),
      onRemove: () =>
        onImportanceChange(state.characterImportance.filter((item) => item !== value)),
    });
  }

  return chips;
}
