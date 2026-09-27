"use client";

import type { Nullable, TimelineEventView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { cn } from "@/lib/utils";

import { useTimelineEvents } from "../api/use-timeline-events";
import { markerStyle } from "../model/color-key";
import { eventTypeMeta } from "../model/event-type-meta";
import { createFilterState } from "../model/timeline-events-query";

const EVENT_PICKER = {
  searchDebounceMs: 300,
  serverSearchMinLength: 2,
  skeletonCount: 3,
} as const;

type TimelineEventSingleSelectPickerProps = {
  bookId: string;
  excludeIds: readonly string[];
  onSelect: (event: TimelineEventView) => void;
  searchLabel: string;
  selectedId: Nullable<string>;
};

export function TimelineEventSingleSelectPicker({
  bookId,
  excludeIds,
  onSelect,
  searchLabel,
  selectedId,
}: TimelineEventSingleSelectPickerProps) {
  const t = useTranslations("timeline");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query.trim(), EVENT_PICKER.searchDebounceMs);
  const search = debouncedQuery.length >= EVENT_PICKER.serverSearchMinLength ? debouncedQuery : "";

  const eventsQuery = useTimelineEvents(bookId, { ...createFilterState(null), search });
  const items = (eventsQuery.data?.pages ?? [])
    .flatMap((page) => page.items)
    .filter((event) => !excludeIds.includes(event.id));

  const { onScroll, scrollRef } = useInfiniteScroll({
    hasNextPage: eventsQuery.hasNextPage && !eventsQuery.isFetchNextPageError,
    isFetchingNextPage: eventsQuery.isFetchingNextPage,
    itemCount: items.length,
    onLoadMore: () => void eventsQuery.fetchNextPage(),
  });

  return (
    <div className="flex flex-col gap-2">
      <Input
        aria-label={searchLabel}
        autoComplete="off"
        className="h-10"
        isClearable
        onChange={(event) => setQuery(event.target.value)}
        onClear={() => setQuery("")}
        placeholder={searchLabel}
        value={query}
      />

      <div
        aria-busy={eventsQuery.isPlaceholderData}
        className={cn(
          "max-h-60 overflow-y-auto rounded-lg border p-1 transition-colors",
          eventsQuery.isPlaceholderData ? "border-dashed border-accent-border" : "border-border",
        )}
        onScroll={onScroll}
        ref={scrollRef}
      >
        <PickerResults
          isError={eventsQuery.isError && !eventsQuery.isFetchNextPageError}
          isPending={eventsQuery.isPending}
          items={items}
          onRetry={() => void eventsQuery.refetch()}
          onSelect={onSelect}
          selectedId={selectedId}
        />
        {eventsQuery.isFetchingNextPage ? (
          <p className="py-2 text-center text-xs text-muted-foreground">{t("picker.loading")}</p>
        ) : null}
        {eventsQuery.isFetchNextPageError ? (
          <div
            className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground"
            role="alert"
          >
            <span>{t("states.loadMoreError")}</span>
            <Button
              onClick={() => void eventsQuery.fetchNextPage()}
              size="sm"
              type="button"
              variant="ghost"
            >
              {t("states.retry")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PickerResults({
  isError,
  isPending,
  items,
  onRetry,
  onSelect,
  selectedId,
}: {
  isError: boolean;
  isPending: boolean;
  items: TimelineEventView[];
  onRetry: () => void;
  onSelect: (event: TimelineEventView) => void;
  selectedId: Nullable<string>;
}) {
  const t = useTranslations("timeline");

  if (isPending) {
    return (
      <div aria-busy aria-hidden className="flex flex-col gap-1">
        {Array.from({ length: EVENT_PICKER.skeletonCount }, (_, index) => (
          <div className="flex items-center gap-3 p-2" key={index}>
            <Skeleton className="size-4 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 px-3 py-6 text-center" role="alert">
        <p className="text-sm text-muted-foreground">{t("picker.error")}</p>
        <Button onClick={onRetry} size="sm" type="button" variant="secondary">
          {t("states.retry")}
        </Button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("picker.empty")}</p>
    );
  }

  return (
    <RadioGroup
      aria-label={t("picker.results")}
      className="gap-1"
      onValueChange={(nextId) => {
        const event = items.find((item) => item.id === nextId);
        if (event === undefined) return;
        onSelect(event);
      }}
      value={selectedId ?? ""}
    >
      {items.map((event) => (
        <PickerRow event={event} isSelected={selectedId === event.id} key={event.id} />
      ))}
    </RadioGroup>
  );
}

function PickerRow({ event, isSelected }: { event: TimelineEventView; isSelected: boolean }) {
  const t = useTranslations("timeline");
  const optionId = useId();
  const typeMeta = eventTypeMeta(event.eventType);

  return (
    <Label
      className={cn(
        "cursor-pointer items-start gap-3 rounded-lg border border-transparent p-2 font-normal transition-colors hover:border-accent-border hover:bg-secondary/50 has-[:focus-visible]:bg-secondary/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ring",
        isSelected && "border-primary bg-secondary/40",
      )}
      htmlFor={optionId}
    >
      <RadioGroupItem aria-label={event.title} className="mt-0.5" id={optionId} value={event.id} />
      <UiIcon className="mt-0.5 shrink-0 text-icon" name={typeMeta.icon} size={15} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-ink">{event.title}</span>
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={markerStyle(event.timelineColorKey)}
            />
            <span className="truncate">{event.timelineName}</span>
          </span>
          {event.chapter === null ? null : <span className="truncate">{event.chapter}</span>}
          {event.pageNumber === null ? null : (
            <span className="tabular-nums">{t("list.page", { page: event.pageNumber })}</span>
          )}
        </span>
      </span>
    </Label>
  );
}
