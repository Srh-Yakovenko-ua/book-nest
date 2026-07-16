"use client";

import type { BookView, ReadingHistorySummaryView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { RatingScore } from "@/components/ui/rating-score";
import { formatDate, formatNumber } from "@/lib/format";

import { ReadingProgressBar } from "../reading/reading-progress-bar";

type DetailRow = {
  key: string;
  label: string;
  value: string;
};

type ReadingProgressSummaryProps = {
  book: BookView;
  summary: ReadingHistorySummaryView;
};

export function ReadingProgressSummary({ book, summary }: ReadingProgressSummaryProps) {
  const t = useTranslations("books.details.reading");
  const tFields = useTranslations("books.readingStatus.fields");
  const locale = useLocale();

  const status = summary.status;
  const startedValue = summary.startedAt ?? summary.readingPeriod.startDate;
  const rating = book.readingProgress?.rating ?? null;
  const note = book.readingProgress?.note ?? null;
  const impression = book.readingProgress?.impression ?? null;

  const rows: DetailRow[] = [];
  const pushDate = (key: string, label: string, value: null | string) => {
    if (value !== null) rows.push({ key, label, value: formatDate(value, locale) });
  };

  if (status === "reading" || status === "rereading") {
    pushDate("started", t("started"), startedValue);
    pushDate("updated", t("updated"), summary.lastProgressUpdateAt);
    if (summary.pagesRemaining !== null) {
      rows.push({
        key: "remaining",
        label: t("remaining"),
        value: t("pagesUnit", { count: summary.pagesRemaining }),
      });
    }
  } else if (status === "finished") {
    pushDate("started", t("started"), startedValue);
    pushDate("finished", t("finishedDate"), summary.finishedAt);
    if (summary.readingPeriod.calendarDays !== null) {
      rows.push({
        key: "duration",
        label: t("duration"),
        value: t("daysUnit", { count: summary.readingPeriod.calendarDays }),
      });
    }
  } else if (status === "paused") {
    pushDate("started", t("started"), startedValue);
    pushDate("paused", t("pausedSince"), summary.pausedAt);
    rows.push({
      key: "stop",
      label: t("stopPageLabel"),
      value: formatNumber(summary.currentPage, locale),
    });
  } else if (status === "dnf") {
    pushDate("started", t("started"), startedValue);
    pushDate("stopped", t("stopped"), summary.abandonedAt);
    rows.push({
      key: "stop",
      label: t("stopPageLabel"),
      value: formatNumber(summary.currentPage, locale),
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <ReadingProgressBar
        currentPage={summary.currentPage}
        muted={status === "dnf"}
        pagesCount={summary.pagesCount}
        percent={summary.progressPercent}
      />

      {rating === null ? null : <RatingScore value={rating} />}

      {rows.length === 0 ? null : (
        <dl className="flex flex-col gap-2">
          {rows.map((row) => (
            <div className="flex items-baseline justify-between gap-4" key={row.key}>
              <dt className="shrink-0 text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-right text-sm text-foreground/90 tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {note === null ? null : (
        <NoteBlock
          label={status === "dnf" ? t("statusDialog.reason") : tFields("note")}
          value={note}
        />
      )}
      {impression === null ? null : <NoteBlock label={tFields("impression")} value={impression} />}
    </div>
  );
}

function NoteBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="text-sm leading-relaxed text-foreground/90">{value}</p>
    </div>
  );
}
