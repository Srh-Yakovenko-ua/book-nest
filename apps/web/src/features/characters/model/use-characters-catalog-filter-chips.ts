"use client";

import { useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books";

import { useBook, useSelectedTags } from "@/features/books";
import { useSeriesDetails } from "@/features/series";

import type {
  CharactersCatalogQuickFilter,
  CharactersCatalogSpoilerFilter,
  CharactersCatalogState,
} from "./characters-catalog-query";
import type { CharactersCatalogAdvancedPatch } from "./use-characters-catalog-query";

import { useCharacterGroupOptions } from "../api/use-character-group-options";
import {
  BOOK_CHARACTER_IMPORTANCE,
  BOOK_CHARACTER_ROLE,
  GENDER_OPTIONS,
} from "./character-options";

const CHIP_LABEL_KEY = {
  quick: {
    favorites: "favorites",
    multiple_books: "multipleBooks",
    with_impression: "withImpression",
  },
  spoilers: {
    with: "withSpoilers",
    without: "withoutSpoilers",
  },
} as const satisfies {
  quick: Record<Exclude<CharactersCatalogQuickFilter, "all">, string>;
  spoilers: Record<Exclude<CharactersCatalogSpoilerFilter, "all">, string>;
};

type UseCharactersCatalogFilterChipsOptions = {
  onAdvancedChange: (patch: CharactersCatalogAdvancedPatch) => void;
  onFilterChange: (value: CharactersCatalogQuickFilter) => void;
  onSearch: (value: string) => void;
  resolveSpeciesName: (id: string) => string | undefined;
  state: CharactersCatalogState;
};

export function useCharactersCatalogFilterChips({
  onAdvancedChange,
  onFilterChange,
  onSearch,
  resolveSpeciesName,
  state,
}: UseCharactersCatalogFilterChipsOptions): ActiveFilterChip[] {
  const t = useTranslations("characters.activeFilters");
  const tQuick = useTranslations("characters.catalog.quick");
  const tAttitude = useTranslations("characters.attitude");
  const tGender = useTranslations("characters.gender");
  const tImportance = useTranslations("characters.importance");
  const tRole = useTranslations("characters.roleType");
  const groups = useCharacterGroupOptions(state.groupId.length > 0);
  const series = useSeriesDetails(state.seriesId ?? "", { enabled: state.seriesId !== null });
  const book = useBook(state.bookId ?? "", { enabled: state.bookId !== null });
  const tags = useSelectedTags(state.tagId);

  const chips: ActiveFilterChip[] = [];

  const search = state.q.trim();
  if (search !== "") {
    chips.push({
      key: "q",
      label: t("search", { query: search }),
      onRemove: () => onSearch(""),
    });
  }

  if (state.filter !== "all") {
    chips.push({
      key: "filter",
      label: tQuick(CHIP_LABEL_KEY.quick[state.filter]),
      onRemove: () => onFilterChange("all"),
    });
  }

  if (state.seriesId !== null) {
    chips.push({
      key: "seriesId",
      label: t("series", {
        name: series.data?.name ?? (series.isPending ? t("pending") : t("unknown")),
      }),
      onRemove: () => onAdvancedChange({ seriesId: null }),
    });
  }

  if (state.bookId !== null) {
    chips.push({
      key: "bookId",
      label: t("book", {
        name: book.data?.title ?? (book.isPending ? t("pending") : t("unknown")),
      }),
      onRemove: () => onAdvancedChange({ bookId: null }),
    });
  }

  for (const value of state.importance) {
    const option = BOOK_CHARACTER_IMPORTANCE.options.find((item) => item === value);
    chips.push({
      key: `importance:${value}`,
      label: t("importance", { label: option === undefined ? t("unknown") : tImportance(option) }),
      onRemove: () =>
        onAdvancedChange({ importance: state.importance.filter((item) => item !== value) }),
    });
  }

  for (const value of state.role) {
    const option = BOOK_CHARACTER_ROLE.options.find((item) => item === value);
    chips.push({
      key: `role:${value}`,
      label: t("role", { label: option === undefined ? t("unknown") : tRole(option) }),
      onRemove: () => onAdvancedChange({ role: state.role.filter((item) => item !== value) }),
    });
  }

  for (const value of state.gender) {
    const option = GENDER_OPTIONS.find((item) => item === value);
    chips.push({
      key: `gender:${value}`,
      label: t("gender", { label: option === undefined ? t("unknown") : tGender(option) }),
      onRemove: () => onAdvancedChange({ gender: state.gender.filter((item) => item !== value) }),
    });
  }

  for (const value of state.speciesId) {
    chips.push({
      key: `speciesId:${value}`,
      label: t("species", { name: resolveSpeciesName(value) ?? t("unknown") }),
      onRemove: () =>
        onAdvancedChange({ speciesId: state.speciesId.filter((item) => item !== value) }),
    });
  }

  for (const value of state.attitude) {
    chips.push({
      key: `attitude:${value}`,
      label: t("attitude", { label: tAttitude(value) }),
      onRemove: () =>
        onAdvancedChange({ attitude: state.attitude.filter((item) => item !== value) }),
    });
  }

  for (const value of state.tagId) {
    chips.push({
      key: `tagId:${value}`,
      label: t("tag", { name: tags.get(value)?.name ?? t("unknown") }),
      onRemove: () => onAdvancedChange({ tagId: state.tagId.filter((item) => item !== value) }),
    });
  }

  for (const value of state.groupId) {
    const groupName = groups.data?.items.find((group) => group.id === value)?.name;
    chips.push({
      key: `groupId:${value}`,
      label: t("group", {
        name: groupName ?? (groups.isPending ? t("pending") : t("unknown")),
      }),
      onRemove: () => onAdvancedChange({ groupId: state.groupId.filter((item) => item !== value) }),
    });
  }

  if (state.spoilers !== "all") {
    chips.push({
      key: "spoilers",
      label: t(CHIP_LABEL_KEY.spoilers[state.spoilers]),
      onRemove: () => onAdvancedChange({ spoilers: "all" }),
    });
  }

  return chips;
}
