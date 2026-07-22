"use client";

import type { Nullable, ReadingQueueItemView } from "@app/shared";

import { isClosedReadingStatus } from "@app/shared";
import { useFormatter, useTranslations } from "next-intl";
import { useId, useState } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type {
  QueueEstimate,
  QueueVolumeForecast,
  QueueVolumeNote,
} from "../model/queue-volume-format";

import { useQueueVolumeSummary } from "../api/use-queue-volume";
import { toQueueVolumeForecast } from "../model/queue-volume-format";
import { QueueVolumeDataDialog } from "./queue-volume-data-dialog";

const CARD_SHELL = "flex flex-col gap-3 rounded-xl border border-border bg-card p-4";

const NOTE_KEYS = {
  noVolumeData: "forecast.noVolumeData",
  staleActivity: "forecast.staleActivity",
  updateProgress: "forecast.updateProgress",
} as const satisfies Record<QueueVolumeNote, string>;

type Insight = {
  icon: UiIconName;
  key: string;
  text: string;
};

type QueueVolumeBlockProps = {
  className?: string;
  items: ReadingQueueItemView[];
};

export function QueueVolumeBlock({ className, items }: QueueVolumeBlockProps) {
  const t = useTranslations("readingQueue.volume");
  const format = useFormatter();
  const headingId = useId();
  const summary = useQueueVolumeSummary();
  const [dataDialogOpen, setDataDialogOpen] = useState(false);

  if (summary.isPending) return <QueueVolumeSkeleton className={className} />;

  const view = summary.data;

  if (view === undefined) {
    return (
      <div className={cn(CARD_SHELL, "items-start gap-2.5", className)}>
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive">
          <UiIcon name="alert-circle" size={16} />
          {t("error.load")}
        </p>
        <Button onClick={() => void summary.refetch()} size="sm" variant="secondary">
          <UiIcon name="refresh" size={14} />
          {t("error.retry")}
        </Button>
      </div>
    );
  }

  if (view.estimate.reasonUnavailable === "empty_queue") return null;

  const forecast = toQueueVolumeForecast(view.estimate);
  const isPartialCoverage = view.estimate.reasonUnavailable === "insufficient_coverage";
  const closedInQueueCount = items.filter((item) =>
    isClosedReadingStatus(item.book.readingStatus),
  ).length;

  const insightCandidates: Nullable<Insight>[] = [
    view.pages.missingBooks > 0
      ? {
          icon: "help-circle",
          key: "missingPages",
          text: t("insights.missingPages", { count: view.pages.missingBooks }),
        }
      : null,
    view.pages.invalidBooks > 0
      ? {
          icon: "alert-triangle",
          key: "invalidProgress",
          text: t("insights.invalidProgress", { count: view.pages.invalidBooks }),
        }
      : null,
    view.audiobookOnlyCount > 0
      ? {
          icon: "headphones",
          key: "audiobookOnly",
          text: t("insights.audiobookOnly", { count: view.audiobookOnlyCount }),
        }
      : null,
    closedInQueueCount > 0
      ? {
          icon: "check-circle",
          key: "closedInQueue",
          text: t("insights.closedInQueue", { count: closedInQueueCount }),
        }
      : null,
  ];
  const insights = insightCandidates.filter((insight) => insight !== null);

  return (
    <>
      <section aria-labelledby={headingId} className={cn(CARD_SHELL, className)}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-heading text-sm font-semibold text-ink" id={headingId}>
            {t("title")}
          </h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("booksInQueue", { count: view.queueBooksCount })}
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <span className="flex items-baseline gap-1.5">
            <span className="font-heading text-3xl leading-[1.12] font-bold text-ink tabular-nums">
              {format.number(view.pages.knownRemaining)}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {t("pagesUnit", { count: view.pages.knownRemaining })}
            </span>
          </span>
          <span className="text-[0.8125rem] text-muted-foreground">
            {isPartialCoverage ? t("remainingPartialCaption") : t("remainingCaption")}
          </span>
        </div>

        <ForecastRow forecast={forecast} />

        <p className="text-xs text-muted-foreground tabular-nums">
          {t("coverage", {
            calculated: view.coverage.calculatedBooks,
            total: view.coverage.totalBooks,
          })}
        </p>

        {insights.length === 0 ? null : (
          <ul className="flex flex-col gap-1.5 border-t border-border pt-3">
            {insights.map((insight) => (
              <li className="flex items-start gap-2 text-xs text-foreground/80" key={insight.key}>
                <UiIcon
                  aria-hidden
                  className="mt-px shrink-0 text-muted-foreground"
                  name={insight.icon}
                  size={14}
                />
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        )}

        {view.hasMissingData ? (
          <Button
            className="self-start"
            onClick={() => setDataDialogOpen(true)}
            size="sm"
            variant="secondary"
          >
            <UiIcon name="edit" size={14} />
            {t("cta")}
          </Button>
        ) : null}
      </section>

      <QueueVolumeDataDialog items={items} onOpenChange={setDataDialogOpen} open={dataDialogOpen} />
    </>
  );
}

export function QueueVolumeSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(CARD_SHELL, className)}>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-36" />
    </div>
  );
}

function EstimateText({ estimate }: { estimate: QueueEstimate }) {
  const t = useTranslations("readingQueue.volume.forecast");

  if (estimate.kind === "overYear") return t("overYear");

  if (estimate.kind === "single") {
    if (estimate.unit === "days") return t("daysSingle", { count: estimate.value });
    if (estimate.unit === "weeks") return t("weeksSingle", { count: estimate.value });
    return t("monthsSingle", { count: estimate.value });
  }

  if (estimate.unit === "days") return t("daysRange", { max: estimate.max, min: estimate.min });
  if (estimate.unit === "weeks") return t("weeksRange", { max: estimate.max, min: estimate.min });
  return t("monthsRange", { max: estimate.max, min: estimate.min });
}

function ForecastRow({ forecast }: { forecast: QueueVolumeForecast }) {
  const t = useTranslations("readingQueue.volume");

  if (forecast.kind === "hidden") return null;

  return (
    <div className="flex items-start gap-2 rounded-lg bg-accent/60 px-3 py-2">
      <UiIcon aria-hidden className="mt-0.5 shrink-0 text-primary" name="clock" size={16} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">{t("forecast.label")}</span>
        {forecast.kind === "countdown" ? (
          <span className="text-sm text-foreground">
            {t("forecast.countdown", { count: forecast.days })}
          </span>
        ) : forecast.kind === "note" ? (
          <span className="text-sm text-foreground">{t(NOTE_KEYS[forecast.note])}</span>
        ) : (
          <span className="text-sm font-semibold text-ink">
            <EstimateText estimate={forecast.estimate} />
          </span>
        )}
      </div>
    </div>
  );
}
