"use client";

import type { Nullable, SeriesView } from "@app/shared";
import type { FocusEvent, Ref } from "react";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { cn } from "@/lib/utils";

import type { SeriesSelectOption } from "../model/series-select-option";

import { useSeriesPickerOptions } from "../api/use-series-picker-options";
import { toSeriesSelectOption } from "../model/series-select-option";
import { SeriesSelectMeta } from "./series-select-meta";
import { SeriesSelectThumb } from "./series-select-thumb";
import { SeriesSingleSelectValue } from "./series-single-select-value";

const SERIES_SINGLE_SELECT_PICKER = {
  searchDebounceMs: 250,
  skeletonCount: 4,
} as const;

export type SeriesSingleSelectPickerLabels = {
  change: string;
  collapse: string;
  empty: string;
  loadError: string;
  loading: string;
  loadMoreError: string;
  results: string;
  resultsCount: (count: number) => string;
  retry: string;
  search: string;
};

type PendingFocus = "change" | "search" | HTMLElement;

type PickerView = "list" | "value";

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
  invalid = false,
  labelledBy,
  labels,
  onChange,
  ref,
  required = false,
  value,
}: SeriesSingleSelectPickerProps) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<PickerView>(value === null ? "list" : "value");
  const debouncedSearch = useDebouncedValue(search, SERIES_SINGLE_SELECT_PICKER.searchDebounceMs);

  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<Nullable<HTMLInputElement>>(null);
  const pendingFocusRef = useRef<Nullable<PendingFocus>>(null);
  const isPointerSelectionRef = useRef(false);

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

  const items = (data?.pages ?? []).flatMap((page) => page.items);
  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage: hasNextPage && !isFetchNextPageError,
    isFetchingNextPage,
    itemCount: items.length,
    onLoadMore: () => void fetchNextPage(),
  });

  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (pending === null) return;
    pendingFocusRef.current = null;
    if (pending === "search") {
      searchInputRef.current?.focus();
      return;
    }
    if (pending instanceof HTMLElement && pending.isConnected) {
      pending.focus();
      return;
    }
    changeButtonRef.current?.focus();
  });

  function attachSearchInput(element: Nullable<HTMLInputElement>) {
    searchInputRef.current = element;
    if (typeof ref === "function") {
      ref(element);
      return;
    }
    if (ref === null || ref === undefined) return;
    ref.current = element;
  }

  function showSelected(focus: Nullable<PendingFocus>) {
    pendingFocusRef.current = focus;
    setView("value");
  }

  function select(series: SeriesView) {
    onChange(series);
    if (!isPointerSelectionRef.current) return;
    isPointerSelectionRef.current = false;
    showSelected("change");
  }

  function leavePicker(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    if (value === null) return;
    showSelected(event.relatedTarget instanceof HTMLElement ? event.relatedTarget : "change");
  }

  if (value !== null && view === "value") {
    return (
      <div aria-labelledby={labelledBy} role="group">
        <SeriesSingleSelectValue
          action={
            <Button
              aria-describedby={`${id}-selected`}
              className="shrink-0"
              onClick={() => {
                pendingFocusRef.current = "search";
                setView("list");
              }}
              ref={changeButtonRef}
              size="sm"
              type="button"
              variant="ghost"
            >
              {labels.change}
            </Button>
          }
          detailsId={`${id}-selected`}
          series={value}
        />
      </div>
    );
  }

  return (
    <div
      aria-labelledby={labelledBy}
      className="flex flex-col gap-2"
      onBlur={leavePicker}
      role="group"
    >
      <div className="flex items-center gap-2">
        <Input
          aria-describedby={describedBy}
          aria-invalid={invalid}
          aria-label={labels.search}
          autoComplete="off"
          className="h-10"
          id={id}
          isClearable
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          placeholder={labels.search}
          ref={attachSearchInput}
          value={search}
        />
        {value === null ? null : (
          <Button
            className="shrink-0"
            onClick={() => showSelected("change")}
            size="sm"
            type="button"
            variant="ghost"
          >
            {labels.collapse}
          </Button>
        )}
      </div>

      <p className="sr-only" role="status">
        {liveStatus({ isError, isPending, isPlaceholderData, itemCount: items.length, labels })}
      </p>

      <div
        aria-busy={isPlaceholderData}
        className={cn(
          "max-h-64 overflow-y-auto rounded-lg border p-1 transition-colors",
          isPlaceholderData
            ? "border-dashed border-accent-border [&_[data-slot=series-thumb]]:opacity-40"
            : "border-border",
        )}
        key={debouncedSearch}
        onKeyDownCapture={() => {
          isPointerSelectionRef.current = false;
        }}
        onPointerDownCapture={() => {
          isPointerSelectionRef.current = true;
        }}
        onScroll={onScroll}
        ref={scrollRef}
      >
        {isPlaceholderData ? (
          <p className="py-2 text-center text-xs text-muted-foreground">{labels.loading}</p>
        ) : null}
        <SeriesSingleSelectResults
          idPrefix={id}
          isError={isError}
          isPending={isPending}
          items={items}
          labels={labels}
          onSelect={select}
          required={required}
          selectedId={value?.id ?? null}
        />
        {isFetchingNextPage ? (
          <p className="py-2 text-center text-xs text-muted-foreground">{labels.loading}</p>
        ) : null}
        {isFetchNextPageError ? (
          <div
            className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground"
            role="alert"
          >
            <span>{labels.loadMoreError}</span>
            <Button onClick={() => void fetchNextPage()} size="sm" type="button" variant="ghost">
              {labels.retry}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function liveStatus({
  isError,
  isPending,
  isPlaceholderData,
  itemCount,
  labels,
}: {
  isError: boolean;
  isPending: boolean;
  isPlaceholderData: boolean;
  itemCount: number;
  labels: SeriesSingleSelectPickerLabels;
}): string {
  if (isPending || isPlaceholderData) return labels.loading;
  if (itemCount > 0) return labels.resultsCount(itemCount);
  if (isError) return "";
  return labels.empty;
}

function SeriesSingleSelectResults({
  idPrefix,
  isError,
  isPending,
  items,
  labels,
  onSelect,
  required,
  selectedId,
}: {
  idPrefix: string;
  isError: boolean;
  isPending: boolean;
  items: SeriesView[];
  labels: SeriesSingleSelectPickerLabels;
  onSelect: (series: SeriesView) => void;
  required: boolean;
  selectedId: Nullable<string>;
}) {
  if (isPending) {
    return (
      <div aria-busy aria-hidden className="flex flex-col gap-1">
        {Array.from({ length: SERIES_SINGLE_SELECT_PICKER.skeletonCount }, (_, index) => (
          <div className="flex items-center gap-3 p-2" key={index}>
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <Skeleton className="h-12 w-9 shrink-0 rounded-sm" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError && items.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground" role="alert">
        {labels.loadError}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <p aria-hidden className="px-3 py-6 text-center text-sm text-muted-foreground">
        {labels.empty}
      </p>
    );
  }

  return (
    <RadioGroup
      aria-label={labels.results}
      className="gap-1"
      onValueChange={(nextId) => {
        const series = items.find((item) => item.id === nextId);
        if (series === undefined) return;
        onSelect(series);
      }}
      required={required}
      value={selectedId ?? ""}
    >
      {items.map((series) => (
        <SeriesSingleSelectRow
          idPrefix={idPrefix}
          isSelected={selectedId === series.id}
          key={series.id}
          series={toSeriesSelectOption(series)}
        />
      ))}
    </RadioGroup>
  );
}

function SeriesSingleSelectRow({
  idPrefix,
  isSelected,
  series,
}: {
  idPrefix: string;
  isSelected: boolean;
  series: SeriesSelectOption;
}) {
  return (
    <Label
      className={cn(
        "cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 font-normal transition-colors hover:border-accent-border hover:bg-secondary/50 has-[:focus-visible]:bg-secondary/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ring",
        isSelected && "border-primary bg-secondary/40 ring-1 ring-primary",
      )}
      htmlFor={`${idPrefix}-option-${series.id}`}
    >
      <RadioGroupItem id={`${idPrefix}-option-${series.id}`} value={series.id} />
      <SeriesSelectThumb series={series} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-ink">{series.name}</span>
        <SeriesSelectMeta series={series} />
      </span>
    </Label>
  );
}
