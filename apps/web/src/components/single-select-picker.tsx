"use client";

import type { Nullable } from "@app/shared";
import type { FocusEvent, ReactNode, Ref } from "react";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { cn } from "@/lib/utils";

const SINGLE_SELECT_PICKER = {
  skeletonCount: 4,
} as const;

export type SingleSelectPickerLabels = {
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

type Identified = { id: string };

type PendingFocus = "change" | "search" | HTMLElement;

type PickerView = "list" | "value";

type SelectedValueSlots<TValue> = {
  action: ReactNode;
  detailsId: string;
  value: TValue;
};

type SingleSelectPickerProps<TOption extends Identified, TValue extends Identified> = {
  appliedSearch: string;
  describedBy?: string;
  id: string;
  invalid?: boolean;
  labelledBy: string;
  labels: SingleSelectPickerLabels;
  onChange: (option: TOption) => void;
  onSearchChange: (search: string) => void;
  ref?: Ref<HTMLInputElement>;
  renderOption: (option: TOption) => ReactNode;
  renderValue: (slots: SelectedValueSlots<TValue>) => ReactNode;
  required?: boolean;
  results: SingleSelectPickerResults<TOption>;
  search: string;
  staleResultsClassName: string;
  value: Nullable<TValue>;
};

type SingleSelectPickerResults<TOption> = {
  fetchNextPage: () => Promise<unknown>;
  hasNextPage: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  isPending: boolean;
  isPlaceholderData: boolean;
  items: TOption[];
};

export function SingleSelectPicker<TOption extends Identified, TValue extends Identified>({
  appliedSearch,
  describedBy,
  id,
  invalid = false,
  labelledBy,
  labels,
  onChange,
  onSearchChange,
  ref,
  renderOption,
  renderValue,
  required = false,
  results,
  search,
  staleResultsClassName,
  value,
}: SingleSelectPickerProps<TOption, TValue>) {
  const [view, setView] = useState<PickerView>(value === null ? "list" : "value");

  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<Nullable<HTMLInputElement>>(null);
  const pendingFocusRef = useRef<Nullable<PendingFocus>>(null);
  const isPointerSelectionRef = useRef(false);

  const {
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isFetchNextPageError,
    isPending,
    isPlaceholderData,
    items,
  } = results;
  const selectedDetailsId = `${id}-selected`;

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

  function select(option: TOption) {
    onChange(option);
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
        {renderValue({
          action: (
            <Button
              aria-describedby={selectedDetailsId}
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
          ),
          detailsId: selectedDetailsId,
          value,
        })}
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
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={() => onSearchChange("")}
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
            ? `border-dashed border-accent-border ${staleResultsClassName}`
            : "border-border",
        )}
        key={appliedSearch}
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
        <SingleSelectResults
          idPrefix={id}
          isError={isError}
          isPending={isPending}
          items={items}
          labels={labels}
          onSelect={select}
          renderOption={renderOption}
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
  labels: SingleSelectPickerLabels;
}): string {
  if (isPending || isPlaceholderData) return labels.loading;
  if (itemCount > 0) return labels.resultsCount(itemCount);
  if (isError) return "";
  return labels.empty;
}

function SingleSelectResults<TOption extends Identified>({
  idPrefix,
  isError,
  isPending,
  items,
  labels,
  onSelect,
  renderOption,
  required,
  selectedId,
}: {
  idPrefix: string;
  isError: boolean;
  isPending: boolean;
  items: TOption[];
  labels: SingleSelectPickerLabels;
  onSelect: (option: TOption) => void;
  renderOption: (option: TOption) => ReactNode;
  required: boolean;
  selectedId: Nullable<string>;
}) {
  if (isPending) {
    return (
      <div aria-busy aria-hidden className="flex flex-col gap-1">
        {Array.from({ length: SINGLE_SELECT_PICKER.skeletonCount }, (_, index) => (
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
        const option = items.find((item) => item.id === nextId);
        if (option === undefined) return;
        onSelect(option);
      }}
      required={required}
      value={selectedId ?? ""}
    >
      {items.map((option) => {
        const optionInputId = `${idPrefix}-option-${option.id}`;

        return (
          <Label
            className={cn(
              "cursor-pointer items-center gap-3 rounded-lg border border-transparent p-2 font-normal transition-colors hover:border-accent-border hover:bg-secondary/50 has-[:focus-visible]:bg-secondary/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ring",
              selectedId === option.id && "border-primary bg-secondary/40 ring-1 ring-primary",
            )}
            htmlFor={optionInputId}
            key={option.id}
          >
            <RadioGroupItem id={optionInputId} value={option.id} />
            {renderOption(option)}
          </Label>
        );
      })}
    </RadioGroup>
  );
}
