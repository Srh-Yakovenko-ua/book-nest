"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { useSeriesDetails, useSeriesPickerOptions } from "@/features/series";

import type { EntitySearchResult } from "./entity-search-select";

import { EntitySearchSelect } from "./entity-search-select";

type CharactersSeriesFilterProps = {
  onChange: (value: Nullable<string>) => void;
  value: Nullable<string>;
};

export function CharactersSeriesFilter({ onChange, value }: CharactersSeriesFilterProps) {
  const t = useTranslations("characters.catalog.filters");
  const tActive = useTranslations("characters.activeFilters");
  const selected = useSeriesDetails(value ?? "", { enabled: value !== null });

  return (
    <EntitySearchSelect
      label={t("series")}
      labels={{
        clear: t("clearSeries"),
        empty: t("seriesEmpty"),
        placeholder: t("anySeries"),
        search: t("seriesSearch"),
        searching: t("seriesSearching"),
      }}
      onChange={onChange}
      selectedName={selected.data?.name ?? (selected.isError ? tActive("unknown") : undefined)}
      useSearch={useSeriesSearchResult}
      value={value}
    />
  );
}

function useSeriesSearchResult(query: string): EntitySearchResult {
  const series = useSeriesPickerOptions(query);

  return {
    fetchNextPage: () => void series.fetchNextPage(),
    hasNextPage: series.hasNextPage,
    isFetching: series.isFetching,
    isFetchingNextPage: series.isFetchingNextPage,
    items: (series.data?.pages ?? [])
      .flatMap((page) => page.items)
      .map((item) => ({
        detail: item.authors.map((author) => author.name).join(", "),
        id: item.id,
        name: item.name,
      })),
  };
}
