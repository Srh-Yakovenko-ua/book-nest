"use client";

import type { TimelineEventView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

import { useTimelineEvents } from "../api/use-timeline-events";
import { createFilterState } from "../model/timeline-events-query";

const MAX_RESULTS = 8;
const MIN_QUERY_LENGTH = 1;

type EventSearchSelectProps = {
  bookId: string;
  excludeIds: readonly string[];
  onSelect: (event: TimelineEventView) => void;
  placeholder: string;
};

export function EventSearchSelect({
  bookId,
  excludeIds,
  onSelect,
  placeholder,
}: EventSearchSelectProps) {
  const t = useTranslations("timeline.form");
  const [query, setQuery] = useState("");
  const trimmed = useDebouncedValue(query.trim(), 300);
  const isActive = trimmed.length >= MIN_QUERY_LENGTH;

  const filters = { ...createFilterState(null), search: trimmed };
  const eventsQuery = useTimelineEvents(bookId, filters, { enabled: isActive });

  const results = isActive
    ? (eventsQuery.data?.pages[0]?.items ?? [])
        .filter((event) => !excludeIds.includes(event.id))
        .slice(0, MAX_RESULTS)
    : [];

  const showEmpty = isActive && !eventsQuery.isFetching && results.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="relative flex items-center">
        <UiIcon
          aria-hidden
          className="pointer-events-none absolute left-3 text-muted-foreground"
          name="search"
          size={16}
        />
        <input
          aria-label={placeholder}
          autoComplete="off"
          className="h-9 w-full rounded-lg border border-input bg-field pr-3 pl-9 text-sm text-foreground transition-colors outline-none placeholder:text-muted-foreground hover:border-accent-border focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          type="text"
          value={query}
        />
      </div>

      {isActive && results.length > 0 ? (
        <ul className="flex flex-col gap-1 rounded-lg border border-border bg-card p-1">
          {results.map((event) => (
            <li key={event.id}>
              <button
                className="flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors outline-none hover:bg-secondary focus-visible:bg-secondary"
                onClick={() => {
                  onSelect(event);
                  setQuery("");
                }}
                type="button"
              >
                <span className="truncate text-sm text-foreground">{event.title}</span>
                <ResultMeta event={event} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showEmpty ? (
        <p className={cn("px-1 text-xs text-muted-foreground")}>{t("searchEmpty")}</p>
      ) : null}
    </div>
  );
}

function ResultMeta({ event }: { event: TimelineEventView }) {
  const parts: string[] = [event.timelineName];
  if (event.chapter !== null) parts.push(event.chapter);
  if (event.pageNumber !== null) parts.push(String(event.pageNumber));
  return <span className="truncate text-xs text-muted-foreground">{parts.join(" · ")}</span>;
}
