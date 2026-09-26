"use client";

import type { TimelineEventSort } from "@app/shared";

import type { TimelineEventsFilterState } from "../model/timeline-events-query";

import { TimelineFilters } from "./timeline-filters";
import { TimelineSearch } from "./timeline-search";
import { TimelineSort } from "./timeline-sort";

type TimelineToolbarProps = {
  filters: TimelineEventsFilterState;
  isAllLines: boolean;
  onFiltersChange: (filters: TimelineEventsFilterState) => void;
};

export function TimelineToolbar({ filters, isAllLines, onFiltersChange }: TimelineToolbarProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="sm:flex-1">
        <TimelineSearch
          onChange={(search) => onFiltersChange({ ...filters, search })}
          value={filters.search}
        />
      </div>
      <TimelineSort
        isAllLines={isAllLines}
        onChange={(sort: TimelineEventSort) => onFiltersChange({ ...filters, sort })}
        value={filters.sort}
      />
      <TimelineFilters filters={filters} onChange={onFiltersChange} />
    </div>
  );
}
