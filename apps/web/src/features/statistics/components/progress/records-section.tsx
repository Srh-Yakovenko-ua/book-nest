"use client";

import type { ReadingStatisticsRecord, ReadingStatisticsRecordsSection } from "@app/shared";

import { RECORDS_LIMIT } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { resolveReadingDayTarget, toContextActionLink } from "../../model/statistics-drilldown";
import { formatDayLong, formatMonthKey } from "../../model/statistics-format";
import { ReadingDayDetails } from "../details/reading-day-details";
import { StatisticsDetailSurface } from "../details/statistics-detail-surface";
import { ProgressCard } from "./progress-card";
import { ProgressInfoHint } from "./progress-info-hint";

const RECORD_VISUAL = {
  actionClassName:
    "-mx-1 inline-flex min-h-9 items-center gap-1 rounded-md px-1 text-xs font-medium text-foreground underline underline-offset-2 outline-none hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50 @md:min-h-6",
  icons: {
    fastest_completed_read: "clock",
    longest_completed_book: "pages",
    longest_series_marathon: "book-copy",
    longest_streak: "flame",
    most_pages_in_day: "chart-increasing",
    peak_month: "calendar",
    shortest_completed_book: "book",
  },
  tones: [
    { mark: "text-primary", tile: "bg-accent/35" },
    { mark: "text-success", tile: "bg-success-soft/70" },
    { mark: "text-info", tile: "bg-info-soft/70" },
    { mark: "text-favorite", tile: "bg-favorite-soft/70" },
  ],
} as const satisfies {
  actionClassName: string;
  icons: Record<ReadingStatisticsRecord["type"], UiIconName>;
  tones: readonly { mark: string; tile: string }[];
};

type RecordContent = {
  detail?: string;
  headline?: string;
  notes: string[];
  value: string;
};

type RecordTone = (typeof RECORD_VISUAL.tones)[number];

export function RecordsSection({
  isLowerBound,
  records,
}: {
  isLowerBound: boolean;
  records: ReadingStatisticsRecordsSection;
}) {
  const t = useTranslations("statistics.records");

  return (
    <ProgressCard
      description={t("description", { limit: RECORDS_LIMIT })}
      icon="trophy"
      illustration="records"
      title={t("title")}
    >
      <ul className="grid grid-cols-1 gap-3 @md:grid-cols-2">
        {records.items.map((record, index) => (
          <li className="min-w-0" key={record.type}>
            <RecordTile
              isLowerBound={isLowerBound}
              record={record}
              tone={
                RECORD_VISUAL.tones[index % RECORD_VISUAL.tones.length] ?? RECORD_VISUAL.tones[0]
              }
            />
          </li>
        ))}
      </ul>
    </ProgressCard>
  );
}

function RecordAction({ record }: { record: ReadingStatisticsRecord }) {
  const locale = useLocale();
  const t = useTranslations("statistics.records");
  const tActions = useTranslations("statistics.contextActions");
  const tDay = useTranslations("statistics.details.day");

  if (record.type === "most_pages_in_day") {
    const detailDate = resolveReadingDayTarget(record.data.drilldown);
    if (detailDate === null) return null;

    return (
      <StatisticsDetailSurface
        compact={{ closeLabel: tDay("close"), eyebrow: t("types.most_pages_in_day") }}
        detail={() => <ReadingDayDetails date={detailDate} variant="compact" />}
        title={formatDayLong(detailDate, locale)}
        triggerClassName={RECORD_VISUAL.actionClassName}
      >
        {t("openDay")}
        <UiIcon aria-hidden name="arrow-right" size={12} />
      </StatisticsDetailSurface>
    );
  }

  const bookLink = recordBookLink(record);
  if (bookLink === null) return null;

  return (
    <Link className={RECORD_VISUAL.actionClassName} href={bookLink.href}>
      {tActions(bookLink.kind)}
      <UiIcon aria-hidden name="arrow-right" size={12} />
    </Link>
  );
}

function recordBookLink(record: ReadingStatisticsRecord) {
  switch (record.type) {
    case "fastest_completed_read":
    case "longest_completed_book":
    case "shortest_completed_book":
      return record.data.book.bookState === "active"
        ? toContextActionLink({ bookId: record.data.book.bookId, kind: "open_book" })
        : null;
    default:
      return null;
  }
}

function RecordText({ content }: { content: RecordContent }) {
  return (
    <>
      <span className="font-heading text-xl leading-tight font-semibold break-words text-ink tabular-nums">
        {content.value}
      </span>
      {content.headline === undefined ? null : (
        <span className="text-sm font-medium break-words text-foreground">{content.headline}</span>
      )}
      {content.detail === undefined ? null : (
        <span className="text-xs text-muted-foreground">{content.detail}</span>
      )}
    </>
  );
}

function RecordTile({
  isLowerBound,
  record,
  tone,
}: {
  isLowerBound: boolean;
  record: ReadingStatisticsRecord;
  tone: RecordTone;
}) {
  const t = useTranslations("statistics.records");
  const content = useRecordContent(record, isLowerBound);
  const typeLabel = t(`types.${record.type}`);

  return (
    <div
      className={cn(
        "flex h-full min-w-0 flex-col gap-1 rounded-xl border border-border/50 px-3.5 py-2.5",
        tone.tile,
      )}
    >
      <span className="mb-0.5 flex items-center gap-2 text-xs font-medium text-foreground">
        <span
          aria-hidden
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full bg-card",
            tone.mark,
          )}
        >
          <UiIcon name={RECORD_VISUAL.icons[record.type]} size={14} />
        </span>
        <span className="min-w-0 flex-1">{typeLabel}</span>
        {content.notes.length === 0 ? null : (
          <ProgressInfoHint topic={typeLabel}>
            {content.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </ProgressInfoHint>
        )}
      </span>
      <RecordText content={content} />
      <div className="mt-auto flex">
        <RecordAction record={record} />
      </div>
    </div>
  );
}

function useRecordContent(record: ReadingStatisticsRecord, isLowerBound: boolean): RecordContent {
  const locale = useLocale();
  const t = useTranslations("statistics.records");
  const recordedOnly = isLowerBound ? [t("values.recordedOnly")] : [];

  switch (record.type) {
    case "fastest_completed_read":
      return {
        detail: formatDayLong(record.data.finishedAt, locale),
        headline: record.data.book.title,
        notes: [],
        value: t("values.elapsedDays", { count: record.data.elapsedDays }),
      };
    case "longest_completed_book":
    case "shortest_completed_book":
      return {
        detail: formatDayLong(record.data.finishedAt, locale),
        headline: record.data.book.title,
        notes: [],
        value: t("values.pages", { count: record.data.pagesCount }),
      };
    case "longest_series_marathon":
      return {
        detail: formatDayLong(record.data.endFinishedAt, locale),
        headline: record.data.name,
        notes: [],
        value: t("values.marathon", { count: record.data.length }),
      };
    case "longest_streak":
      return {
        detail:
          record.data.startDate === null || record.data.endDate === null
            ? undefined
            : `${formatDayLong(record.data.startDate, locale)} – ${formatDayLong(record.data.endDate, locale)}`,
        notes: recordedOnly,
        value: isLowerBound
          ? t("values.streakDaysAtLeast", { count: record.data.days })
          : t("values.streakDays", { count: record.data.days }),
      };
    case "most_pages_in_day":
      return {
        detail: formatDayLong(record.data.date, locale),
        notes: recordedOnly,
        value: t("values.pages", { count: record.data.pagesRead }),
      };
    case "peak_month":
      return {
        detail: t("values.peakMonthDetail", {
          pages: record.data.pagesRead,
          reads: record.data.completedReads,
        }),
        notes: [
          t("values.peakMonthByReads"),
          ...(isLowerBound ? [t("values.peakMonthPagesIncomplete")] : []),
        ],
        value: formatMonthKey(record.data.month, locale),
      };
  }
}
