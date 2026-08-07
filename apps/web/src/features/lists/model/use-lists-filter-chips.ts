"use client";

import { useTranslations } from "next-intl";

import type { ActiveFilterChip } from "@/features/books/components/library-active-filters";

import type { ListsQueryState } from "./lists-query";
import type { UseListsQueryResult } from "./use-lists-query";

type UseListsFilterChipsOptions = {
  setState: UseListsQueryResult["setState"];
  state: ListsQueryState;
};

export function useListsFilterChips({
  setState,
  state,
}: UseListsFilterChipsOptions): ActiveFilterChip[] {
  const t = useTranslations("books.library.activeFilters");
  const tFilters = useTranslations("lists.catalog.filters");
  const tAttention = useTranslations("lists.catalog.attention");

  const chips: ActiveFilterChip[] = [];

  const search = state.q.trim();
  if (search !== "") {
    chips.push({
      key: "q",
      label: t("search", { query: search }),
      onRemove: () => void setState({ q: null }),
    });
  }

  for (const value of state.fill) {
    chips.push({
      key: `fill:${value}`,
      label: tFilters(`fillOptions.${value}`),
      onRemove: () => void setState({ fill: withoutValue(state.fill, value) }),
    });
  }

  for (const value of state.description) {
    chips.push({
      key: `description:${value}`,
      label: tFilters(`descriptionOptions.${value}`),
      onRemove: () => void setState({ description: withoutValue(state.description, value) }),
    });
  }

  for (const value of state.size) {
    chips.push({
      key: `size:${value}`,
      label: tFilters(`sizeOptions.${value}`),
      onRemove: () => void setState({ size: withoutValue(state.size, value) }),
    });
  }

  if (state.attention !== null) {
    chips.push({
      key: `attention:${state.attention}`,
      label: tAttention(`${state.attention}.title`),
      onRemove: () => void setState({ attention: null }),
    });
  }

  return chips;
}

function withoutValue<TValue>(values: TValue[], removed: TValue): null | TValue[] {
  const next = values.filter((value) => value !== removed);
  return next.length === 0 ? null : next;
}
