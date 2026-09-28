"use client";

import type { TimelineEventSort } from "@app/shared";
import type { ReactNode } from "react";

import type { TimelineEventsFilterState } from "../model/timeline-events-query";

import { TimelineFilters } from "./timeline-filters";
import { TimelineSearch } from "./timeline-search";
import { TimelineSort } from "./timeline-sort";

type TimelineToolbarProps = {
  filters: TimelineEventsFilterState;
  isAllLines: boolean;
  linePicker: ReactNode;
  onFiltersChange: (filters: TimelineEventsFilterState) => void;
};

export function TimelineToolbar({
  filters,
  isAllLines,
  linePicker,
  onFiltersChange,
}: TimelineToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="sm:max-w-80 sm:min-w-40 sm:flex-1">
        <TimelineSearch
          onChange={(search) => onFiltersChange({ ...filters, search })}
          value={filters.search}
        />
      </div>
      {linePicker}
      <TimelineSort
        isAllLines={isAllLines}
        onChange={(sort: TimelineEventSort) => onFiltersChange({ ...filters, sort })}
        value={filters.sort}
      />
      <TimelineFilters filters={filters} onChange={onFiltersChange} />
    </div>
  );
}
