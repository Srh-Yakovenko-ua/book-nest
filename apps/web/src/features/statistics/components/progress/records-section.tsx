"use client";

import type { ReadingStatisticsRecord, ReadingStatisticsRecordsSection } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import { resolveReadingDayTarget, toContextActionLink } from "../../model/statistics-drilldown";
import { formatDayLong, formatMonthKey } from "../../model/statistics-format";
import { ReadingDayDetails } from "../details/reading-day-details";
import { StatisticsDetailSurface } from "../details/statistics-detail-surface";
import { StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";

const RECORD_ICON = {
  fastest_completed_read: "clock",
  longest_completed_book: "pages",
  longest_series_marathon: "book-copy",
  longest_streak: "flame",
  most_pages_in_day: "chart-increasing",
  peak_month: "calendar",
  shortest_completed_book: "book",
} as const satisfies Record<ReadingStatisticsRecord["type"], UiIconName>;

export function RecordsSection({
  isLowerBound,
  records,
}: {
  isLowerBound: boolean;
  records: ReadingStatisticsRecordsSection;
}) {
  const t = useTranslations("statistics.records");

  return (
    <StatisticsSection description={t("description")} title={t("title")}>
      {records.items.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <div
          aria-label={t("title")}
          className="-mx-1 snap-x snap-mandatory overflow-x-auto rounded-lg px-1 pb-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:overflow-visible"
          role="region"
          tabIndex={0}
        >
          <ul className="flex gap-3 lg:grid lg:grid-cols-4">
            {records.items.map((record) => (
              <li className="w-[85%] shrink-0 snap-start lg:w-auto lg:shrink" key={record.type}>
                <RecordCard isLowerBound={isLowerBound} record={record} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </StatisticsSection>
  );
}

function RecordBody({
  isLowerBound,
  record,
}: {
  isLowerBound: boolean;
  record: ReadingStatisticsRecord;
}): ReactNode {
  const locale = useLocale();
  const t = useTranslations("statistics.records");

  switch (record.type) {
    case "fastest_completed_read":
      return (
        <RecordText
          detail={formatDayLong(record.data.finishedAt, locale)}
          headline={record.data.book.title}
          value={t("values.elapsedDays", { count: record.data.elapsedDays })}
        />
      );
    case "longest_completed_book":
    case "shortest_completed_book":
      return (
        <RecordText
          detail={formatDayLong(record.data.finishedAt, locale)}
          headline={record.data.book.title}
          value={t("values.pages", { count: record.data.pagesCount })}
        />
      );
    case "longest_series_marathon":
      return (
        <RecordText
          detail={formatDayLong(record.data.endFinishedAt, locale)}
          headline={record.data.name}
          value={t("values.marathon", { count: record.data.length })}
        />
      );
    case "longest_streak":
      return (
        <RecordText
          detail={
            record.data.startDate === null || record.data.endDate === null
              ? undefined
              : `${formatDayLong(record.data.startDate, locale)} – ${formatDayLong(record.data.endDate, locale)}`
          }
          note={isLowerBound ? t("values.recordedOnly") : undefined}
          value={
            isLowerBound
              ? t("values.streakDaysAtLeast", { count: record.data.days })
              : t("values.streakDays", { count: record.data.days })
          }
        />
      );
    case "most_pages_in_day":
      return (
        <RecordText
          detail={formatDayLong(record.data.date, locale)}
          note={isLowerBound ? t("values.recordedOnly") : undefined}
          value={t("values.pages", { count: record.data.pagesRead })}
        />
      );
    case "peak_month":
      return (
        <RecordText
          detail={t("values.peakMonthDetail", {
            pages: formatNumber(record.data.pagesRead, locale),
            reads: record.data.completedReads,
          })}
          value={formatMonthKey(record.data.month, locale)}
        />
      );
  }
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

function RecordCard({
  isLowerBound,
  record,
}: {
  isLowerBound: boolean;
  record: ReadingStatisticsRecord;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.records");
  const tActions = useTranslations("statistics.contextActions");

  const bookLink = recordBookLink(record);
  const card = (
    <Card className="flex h-full min-w-0 flex-col gap-1.5 px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <UiIcon
          aria-hidden
          className="shrink-0 text-primary"
          name={RECORD_ICON[record.type]}
          size={14}
        />
        <span className="line-clamp-2">{t(`types.${record.type}`)}</span>
      </span>
      <RecordBody isLowerBound={isLowerBound} record={record} />
      {bookLink === null ? null : (
        <Link
          className="-mx-1 mt-auto inline-flex min-h-9 items-center gap-1 self-start rounded-md px-1 text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
          href={bookLink.href}
        >
          {tActions(bookLink.kind)}
          <UiIcon aria-hidden name="arrow-right" size={12} />
        </Link>
      )}
    </Card>
  );

  if (record.type !== "most_pages_in_day") return card;

  const detailDate = resolveReadingDayTarget(record.data.drilldown);
  if (detailDate === null) return card;

  return (
    <StatisticsDetailSurface
      detail={() => <ReadingDayDetails date={detailDate} />}
      title={formatDayLong(detailDate, locale)}
      triggerClassName="h-full w-full rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {card}
    </StatisticsDetailSurface>
  );
}

function RecordText({
  detail,
  headline,
  note,
  value,
}: {
  detail?: string;
  headline?: string;
  note?: string;
  value: string;
}) {
  return (
    <>
      <span className="font-heading text-2xl leading-tight font-semibold text-ink tabular-nums">
        {value}
      </span>
      {headline === undefined ? null : (
        <span className="line-clamp-2 text-sm font-medium text-foreground">{headline}</span>
      )}
      {detail === undefined ? null : (
        <span className="text-xs text-muted-foreground">{detail}</span>
      )}
      {note === undefined ? null : <span className="text-xs text-muted-foreground">{note}</span>}
    </>
  );
}
