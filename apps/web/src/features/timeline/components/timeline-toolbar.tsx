"use client";

import type { TimelineEventSort } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import type { TimelineEventsFilterState } from "../model/timeline-events-query";
import type { TimelineViewMode } from "../model/timeline-view-mode";

import { TimelineFilters } from "./timeline-filters";
import { TimelineSearch } from "./timeline-search";
import { TimelineSort } from "./timeline-sort";
import { TimelineViewSwitch } from "./timeline-view-switch";

type TimelineToolbarProps = {
  filters: TimelineEventsFilterState;
  hasActiveFilters: boolean;
  isAllLines: boolean;
  onFiltersChange: (filters: TimelineEventsFilterState) => void;
  onReset: () => void;
  onViewChange: (view: TimelineViewMode) => void;
  showFilterControls: boolean;
  view: TimelineViewMode;
};

export function TimelineToolbar({
  filters,
  hasActiveFilters,
  isAllLines,
  onFiltersChange,
  onReset,
  onViewChange,
  showFilterControls,
  view,
}: TimelineToolbarProps) {
  const t = useTranslations("timeline.filters");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TimelineViewSwitch onChange={onViewChange} value={view} />
        {showFilterControls ? (
          <TimelineFilters filters={filters} onChange={onFiltersChange} />
        ) : null}
      </div>

      {showFilterControls ? (
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
          {hasActiveFilters ? (
            <Button className="h-10" onClick={onReset} type="button" variant="ghost">
              <UiIcon name="x" size={16} />
              {t("reset")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
