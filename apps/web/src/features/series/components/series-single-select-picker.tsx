"use client";

import type { Nullable, SeriesView } from "@app/shared";
import type { Ref } from "react";

import { useState } from "react";

import type { SingleSelectPickerLabels } from "@/components/single-select-picker";

import { SingleSelectPicker } from "@/components/single-select-picker";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

import type { SeriesSelectOption } from "../model/series-select-option";

import { useSeriesPickerOptions } from "../api/use-series-picker-options";
import { toSeriesSelectOption } from "../model/series-select-option";
import { SeriesSelectMeta } from "./series-select-meta";
import { SeriesSelectThumb } from "./series-select-thumb";
import { SeriesSingleSelectValue } from "./series-single-select-value";

const SERIES_SINGLE_SELECT_PICKER = {
  searchDebounceMs: 250,
} as const;

export type SeriesSingleSelectPickerLabels = SingleSelectPickerLabels;

type SeriesSingleSelectPickerProps = {
  describedBy?: string;
  id: string;
  invalid?: boolean;
  labelledBy: string;
  labels: SeriesSingleSelectPickerLabels;
  onChange: (series: SeriesView) => void;
  ref?: Ref<HTMLInputElement>;
  required?: boolean;
  value: Nullable<SeriesSelectOption>;
};

export function SeriesSingleSelectPicker({
  describedBy,
  id,
  invalid,
  labelledBy,
  labels,
  onChange,
  ref,
  required,
  value,
}: SeriesSingleSelectPickerProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, SERIES_SINGLE_SELECT_PICKER.searchDebounceMs);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isFetchNextPageError,
    isPending,
    isPlaceholderData,
  } = useSeriesPickerOptions(debouncedSearch);

  return (
    <SingleSelectPicker
      appliedSearch={debouncedSearch}
      describedBy={describedBy}
      id={id}
      invalid={invalid}
      labelledBy={labelledBy}
      labels={labels}
      onChange={onChange}
      onSearchChange={setSearch}
      ref={ref}
      renderOption={(series) => <SeriesSingleSelectOption series={toSeriesSelectOption(series)} />}
      renderValue={({ action, detailsId, value: series }) => (
        <SeriesSingleSelectValue action={action} detailsId={detailsId} series={series} />
      )}
      required={required}
      results={{
        fetchNextPage,
        hasNextPage,
        isError,
        isFetchingNextPage,
        isFetchNextPageError,
        isPending,
        isPlaceholderData,
        items: (data?.pages ?? []).flatMap((page) => page.items),
      }}
      search={search}
      staleResultsClassName="[&_[data-slot=series-thumb]]:opacity-40"
      value={value}
    />
  );
}

function SeriesSingleSelectOption({ series }: { series: SeriesSelectOption }) {
  return (
    <>
      <SeriesSelectThumb series={series} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-ink">{series.name}</span>
        <SeriesSelectMeta series={series} />
      </span>
    </>
  );
}
