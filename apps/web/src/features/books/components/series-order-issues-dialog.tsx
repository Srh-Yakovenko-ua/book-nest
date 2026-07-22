"use client";

import type { SeriesOrderActionCode, SeriesOrderIssueView, SeriesOrderSeverity } from "@app/shared";

import { SERIES_ORDER_ISSUES_LIMIT_MAX } from "@app/shared";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { useSeriesOrderIssues } from "../api/use-series-order-check";
import { SeriesOrderIssueCard } from "./series-order-issue-card";

type SeriesOrderIssuesDialogProps = {
  onAction: (input: {
    code: SeriesOrderActionCode;
    issue: SeriesOrderIssueView;
    queueVersion: string;
  }) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pendingFingerprint: null | string;
};

type SeverityCounts = Record<SeriesOrderSeverity, number> & { all: number };

type SeverityFilter = "all" | SeriesOrderSeverity;

type SortKey = "byQueue" | "bySeries" | "byType";

const SKELETON_COUNT = 3;

const SEVERITY_ORDER = [
  "error",
  "warning",
  "info",
] as const satisfies readonly SeriesOrderSeverity[];

const SEVERITY_RANK = {
  error: 0,
  info: 2,
  warning: 1,
} as const satisfies Record<SeriesOrderSeverity, number>;

const SORT_KEYS = ["byQueue", "byType", "bySeries"] as const satisfies readonly SortKey[];

const SORT_COMPARATORS = {
  byQueue: (first, second) => {
    const byQueue = compareQueuePosition(
      first.affectedBook.queuePosition,
      second.affectedBook.queuePosition,
    );
    if (byQueue !== 0) return byQueue;
    return first.series.title.localeCompare(second.series.title, "uk");
  },
  bySeries: (first, second) => {
    const byTitle = first.series.title.localeCompare(second.series.title, "uk");
    if (byTitle !== 0) return byTitle;
    return compareQueuePosition(
      first.affectedBook.queuePosition,
      second.affectedBook.queuePosition,
    );
  },
  byType: (first, second) => {
    const byRank = SEVERITY_RANK[first.severity] - SEVERITY_RANK[second.severity];
    if (byRank !== 0) return byRank;
    const byType = first.problemType.localeCompare(second.problemType);
    if (byType !== 0) return byType;
    return first.series.title.localeCompare(second.series.title, "uk");
  },
} as const satisfies Record<
  SortKey,
  (first: SeriesOrderIssueView, second: SeriesOrderIssueView) => number
>;

export function SeriesOrderIssuesDialog({
  onAction,
  onOpenChange,
  open,
  pendingFingerprint,
}: SeriesOrderIssuesDialogProps) {
  const t = useTranslations("readingQueue.seriesOrderCheck");
  const issues = useSeriesOrderIssues({ enabled: open, limit: SERIES_ORDER_ISSUES_LIMIT_MAX });
  const view = issues.data;

  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("byQueue");

  const showToolbar = view !== undefined && view.items.length > 0;
  const rendered = view === undefined ? [] : visibleIssues(view.items, severityFilter, sortKey);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4 overflow-hidden sm:max-w-[840px]">
        <DialogHeader>
          <DialogTitle>{t("allIssues.title")}</DialogTitle>
          <DialogDescription>{t("allIssues.description")}</DialogDescription>
        </DialogHeader>

        {showToolbar ? (
          <FilterToolbar
            counts={toSeverityCounts(view.items)}
            onSeverityChange={setSeverityFilter}
            onSortChange={setSortKey}
            severityFilter={severityFilter}
            sortKey={sortKey}
          />
        ) : null}

        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
          {issues.isPending ? (
            <div aria-label={t("loading")} className="flex flex-col gap-3" role="status">
              {Array.from({ length: SKELETON_COUNT }, (_, index) => (
                <Skeleton className="h-64 w-full rounded-xl" key={index} />
              ))}
            </div>
          ) : issues.isError || view === undefined ? (
            <div className="flex flex-col items-start gap-3" role="alert">
              <p className="text-sm text-destructive">{t("error.load")}</p>
              <Button onClick={() => void issues.refetch()} size="sm" variant="secondary">
                {t("actions.retry")}
              </Button>
            </div>
          ) : view.items.length === 0 ? (
            <div className="flex flex-col gap-1 py-4 text-center">
              <p className="font-heading text-base font-semibold text-ink">{t("empty.title")}</p>
              <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
            </div>
          ) : rendered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("filters.noMatches")}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {rendered.map((issue) => (
                <li key={issue.fingerprint}>
                  <SeriesOrderIssueCard
                    issue={issue}
                    onAction={(code) => onAction({ code, issue, queueVersion: view.queueVersion })}
                    pending={pendingFingerprint === issue.fingerprint}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function compareQueuePosition(first: null | number, second: null | number): number {
  if (first === null && second === null) return 0;
  if (first === null) return 1;
  if (second === null) return -1;
  return first - second;
}

function FilterToolbar({
  counts,
  onSeverityChange,
  onSortChange,
  severityFilter,
  sortKey,
}: {
  counts: SeverityCounts;
  onSeverityChange: (value: SeverityFilter) => void;
  onSortChange: (value: SortKey) => void;
  severityFilter: SeverityFilter;
  sortKey: SortKey;
}) {
  const t = useTranslations("readingQueue.seriesOrderCheck");
  const activeSeverities = SEVERITY_ORDER.filter((severity) => counts[severity] > 0);
  const severityOptions = [
    { count: counts.all, label: t("filters.all"), value: "all" },
    ...activeSeverities.map((severity) => ({
      count: counts[severity],
      label: t(`filters.${severity}`),
      value: severity,
    })),
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
      <div className="-mx-1 -my-1 no-scrollbar min-w-0 overflow-x-auto px-1 py-1">
        <ChipGroup
          className="flex-nowrap"
          label={t("filters.label")}
          mode="single"
          onValueChange={(next) => {
            if (isSeverityFilter(next)) onSeverityChange(next);
          }}
          options={severityOptions}
          size="sm"
          value={severityFilter}
        />
      </div>

      <Select
        onValueChange={(value) => {
          if (isSortKey(value)) onSortChange(value);
        }}
        value={sortKey}
      >
        <SelectTrigger aria-label={t("sort.label")} size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {SORT_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {t(`sort.${key}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function isSeverityFilter(value: string): value is SeverityFilter {
  return value === "all" || (SEVERITY_ORDER as readonly string[]).includes(value);
}

function isSortKey(value: string): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value);
}

function toSeverityCounts(items: SeriesOrderIssueView[]): SeverityCounts {
  return {
    all: items.length,
    error: items.filter((item) => item.severity === "error").length,
    info: items.filter((item) => item.severity === "info").length,
    warning: items.filter((item) => item.severity === "warning").length,
  };
}

function visibleIssues(
  items: SeriesOrderIssueView[],
  severityFilter: SeverityFilter,
  sortKey: SortKey,
): SeriesOrderIssueView[] {
  const filtered =
    severityFilter === "all" ? items : items.filter((item) => item.severity === severityFilter);
  return filtered.slice().sort(SORT_COMPARATORS[sortKey]);
}
