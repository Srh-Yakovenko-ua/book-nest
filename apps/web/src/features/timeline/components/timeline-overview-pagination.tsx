"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

const OVERVIEW_PAGE_SIZE = 4;

type OverviewPage<Item> = {
  canNext: boolean;
  canPrev: boolean;
  from: number;
  items: Item[];
  next: () => void;
  prev: () => void;
  to: number;
  total: number;
};

type TimelineOverviewPaginationProps = {
  canNext: boolean;
  canPrev: boolean;
  from: number;
  onNext: () => void;
  onPrev: () => void;
  to: number;
  total: number;
};

export function TimelineOverviewPagination({
  canNext,
  canPrev,
  from,
  onNext,
  onPrev,
  to,
  total,
}: TimelineOverviewPaginationProps) {
  const t = useTranslations("timeline.overview");

  if (!canPrev && !canNext) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground tabular-nums">
        {t("range", { from, to, total })}
      </span>
      <Button
        aria-label={t("prevPage")}
        disabled={!canPrev}
        onClick={onPrev}
        size="icon-sm"
        variant="ghost"
      >
        <UiIcon name="chevron-left" size={16} />
      </Button>
      <Button
        aria-label={t("nextPage")}
        disabled={!canNext}
        onClick={onNext}
        size="icon-sm"
        variant="ghost"
      >
        <UiIcon name="chevron-right" size={16} />
      </Button>
    </div>
  );
}

export function useOverviewPage<Item>(items: readonly Item[]): OverviewPage<Item> {
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(items.length / OVERVIEW_PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const start = current * OVERVIEW_PAGE_SIZE;

  return {
    canNext: current < pageCount - 1,
    canPrev: current > 0,
    from: items.length === 0 ? 0 : start + 1,
    items: items.slice(start, start + OVERVIEW_PAGE_SIZE),
    next: () => setPage(current + 1),
    prev: () => setPage(current - 1),
    to: Math.min(start + OVERVIEW_PAGE_SIZE, items.length),
    total: items.length,
  };
}
