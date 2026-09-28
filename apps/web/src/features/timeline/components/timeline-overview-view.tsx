"use client";

import type {
  TimelineColorKey,
  TimelineEventType,
  TimelineImportance,
  TimelineOverviewView as TimelineOverview,
  TimelineView,
} from "@app/shared";

import { TIMELINE_EVENT_TYPES } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { PALETTE_COLOR_STYLES } from "@/components/ui/palette-color";
import { StatCard } from "@/components/ui/stat-card";
import { formatNumber } from "@/lib/format";

import { markerStyle } from "../model/color-key";
import { EVENT_TYPE_META } from "../model/event-type-meta";
import { IMPORTANCE_META } from "../model/importance-meta";
import { TimelineOverviewCard, TimelineOverviewRow } from "./timeline-overview-card";
import { TimelineOverviewPagination, useOverviewPage } from "./timeline-overview-pagination";

const IMPORTANCE_CARD_ORDER = [
  "key",
  "high",
  "medium",
  "low",
] as const satisfies readonly TimelineImportance[];

type ChapterRow = {
  chapter: string;
  count: number;
};

type ImportanceRow = {
  count: number;
  importance: TimelineImportance;
};

type LineRow = {
  colorKey: TimelineColorKey;
  count: number;
  id: string;
  name: string;
};

type TimelineOverviewViewProps = {
  onSelectImportance: (importance: TimelineImportance) => void;
  onSelectLine: (timelineId: string) => void;
  onSelectType: (eventType: TimelineEventType) => void;
  onSelectWithoutChapter: () => void;
  overview: TimelineOverview;
  timelines: TimelineView[];
};

type TypeRow = {
  count: number;
  eventType: TimelineEventType;
};

export function TimelineOverviewView({
  onSelectImportance,
  onSelectLine,
  onSelectType,
  onSelectWithoutChapter,
  overview,
  timelines,
}: TimelineOverviewViewProps) {
  const t = useTranslations("timeline.overview");
  const locale = useLocale();

  const namedChapters = toNamedChapters(overview.chapterDensity);
  const noChapterCount = overview.chapterDensity.find((item) => item.chapter === null)?.count ?? 0;
  const keyCount = overview.byImportance.find((item) => item.importance === "key")?.count ?? 0;
  const defaultLine = timelines.find((line) => line.isDefault);

  const typeRows = overview.byType
    .filter((item) => item.count > 0)
    .map((item) => ({ count: item.count, eventType: item.eventType }))
    .sort(
      (first, second) =>
        second.count - first.count ||
        TIMELINE_EVENT_TYPES.indexOf(first.eventType) -
          TIMELINE_EVENT_TYPES.indexOf(second.eventType),
    );

  const importanceRows: ImportanceRow[] = IMPORTANCE_CARD_ORDER.map((importance) => ({
    count: overview.byImportance.find((item) => item.importance === importance)?.count ?? 0,
    importance,
  }));

  const lineRows: LineRow[] = [...timelines]
    .sort((first, second) => first.position - second.position)
    .map((line) => ({
      colorKey: line.colorKey,
      count: line.eventsCount,
      id: line.id,
      name: line.name,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="@container/timeline-summary">
        <div className="grid grid-cols-1 gap-3 @sm/timeline-summary:grid-cols-2 @3xl/timeline-summary:grid-cols-4">
          <StatCard
            className="h-full"
            icon="calendar"
            iconBadgeSize="sm"
            iconTone="primary"
            label={t("totalEvents")}
            microfact={
              namedChapters.length > 0
                ? t("inChapters", { count: namedChapters.length })
                : undefined
            }
            size="compact"
            value={formatNumber(overview.totalEvents, locale)}
          />
          <StatCard
            className="h-full"
            icon="help-circle"
            iconBadgeSize="sm"
            iconTone="info"
            label={t("unresolved")}
            microfact={
              overview.resolvedCount > 0
                ? t("resolvedFact", { count: overview.resolvedCount })
                : undefined
            }
            size="compact"
            value={formatNumber(overview.unresolvedCount, locale)}
          />
          <StatCard
            className="h-full"
            icon="star"
            iconBadgeSize="sm"
            iconTone="favorite"
            label={t("keyEvents")}
            size="compact"
            value={formatNumber(keyCount, locale)}
          />
          <StatCard
            className="h-full"
            icon="layers"
            iconBadgeSize="sm"
            iconTone="success"
            label={t("timelines")}
            microfact={
              defaultLine === undefined ? undefined : <DefaultLineFact line={defaultLine} />
            }
            size="compact"
            value={formatNumber(timelines.length, locale)}
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TypeCard onSelect={onSelectType} rows={typeRows} />
        <ImportanceCard onSelect={onSelectImportance} rows={importanceRows} />
        <TimelinesCard onSelect={onSelectLine} rows={lineRows} />
        <ChapterCard
          noChapterCount={noChapterCount}
          onSelectWithoutChapter={onSelectWithoutChapter}
          rows={namedChapters}
        />
      </div>
    </div>
  );
}

function CardEmpty() {
  const t = useTranslations("timeline.overview");
  return <p className="p-1 text-sm text-muted-foreground">{t("empty")}</p>;
}

function ChapterCard({
  noChapterCount,
  onSelectWithoutChapter,
  rows,
}: {
  noChapterCount: number;
  onSelectWithoutChapter: () => void;
  rows: ChapterRow[];
}) {
  const t = useTranslations("timeline.overview");
  const page = useOverviewPage(rows);
  const max = maxCount(rows.map((row) => row.count));

  return (
    <TimelineOverviewCard
      action={
        <TimelineOverviewPagination
          canNext={page.canNext}
          canPrev={page.canPrev}
          from={page.from}
          onNext={page.next}
          onPrev={page.prev}
          to={page.to}
          total={page.total}
        />
      }
      footer={
        noChapterCount === 0 ? undefined : (
          <button
            className="w-full cursor-pointer rounded-b-xl px-4 py-3 text-left text-sm font-medium text-foreground transition-colors outline-none hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={onSelectWithoutChapter}
            type="button"
          >
            {t("noChapterFooter", { count: noChapterCount })}
          </button>
        )
      }
      title={t("chapterDensity")}
    >
      {rows.length === 0 ? (
        <CardEmpty />
      ) : (
        page.items.map((row) => (
          <TimelineOverviewRow count={row.count} key={row.chapter} label={row.chapter} max={max} />
        ))
      )}
    </TimelineOverviewCard>
  );
}

function DefaultLineFact({ line }: { line: TimelineView }) {
  const t = useTranslations("timeline.overview");

  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-1.5">
      <span
        aria-hidden
        className="size-2 shrink-0 rounded-full"
        style={markerStyle(line.colorKey)}
      />
      <span className="truncate">{line.name}</span>
      <span className="shrink-0">{` · ${t("lineEvents", { count: line.eventsCount })}`}</span>
    </span>
  );
}

function ImportanceCard({
  onSelect,
  rows,
}: {
  onSelect: (importance: TimelineImportance) => void;
  rows: ImportanceRow[];
}) {
  const t = useTranslations("timeline.overview");
  const tTimeline = useTranslations("timeline");
  const max = maxCount(rows.map((row) => row.count));

  return (
    <TimelineOverviewCard title={t("byImportance")}>
      {rows.map((row) => (
        <TimelineOverviewRow
          count={row.count}
          key={row.importance}
          label={tTimeline(IMPORTANCE_META[row.importance].labelKey)}
          max={max}
          onSelect={() => onSelect(row.importance)}
        />
      ))}
    </TimelineOverviewCard>
  );
}

function maxCount(counts: number[]): number {
  return counts.reduce((max, value) => (value > max ? value : max), 0);
}

function normalizeChapter(chapter: string): string {
  return chapter.trim().toLowerCase();
}

function TimelinesCard({
  onSelect,
  rows,
}: {
  onSelect: (timelineId: string) => void;
  rows: LineRow[];
}) {
  const t = useTranslations("timeline.overview");
  const page = useOverviewPage(rows);
  const max = maxCount(rows.map((row) => row.count));

  return (
    <TimelineOverviewCard
      action={
        <TimelineOverviewPagination
          canNext={page.canNext}
          canPrev={page.canPrev}
          from={page.from}
          onNext={page.next}
          onPrev={page.prev}
          to={page.to}
          total={page.total}
        />
      }
      title={t("timelines")}
    >
      {rows.length === 0 ? (
        <CardEmpty />
      ) : (
        page.items.map((row) => (
          <TimelineOverviewRow
            barColor={PALETTE_COLOR_STYLES[row.colorKey].marker}
            count={row.count}
            icon={
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={markerStyle(row.colorKey)}
              />
            }
            key={row.id}
            label={row.name}
            max={max}
            onSelect={() => onSelect(row.id)}
          />
        ))
      )}
    </TimelineOverviewCard>
  );
}

function toNamedChapters(density: TimelineOverview["chapterDensity"]): ChapterRow[] {
  return density
    .flatMap((item) =>
      item.chapter === null ? [] : [{ chapter: item.chapter, count: item.count }],
    )
    .sort(
      (first, second) =>
        second.count - first.count ||
        normalizeChapter(first.chapter).localeCompare(normalizeChapter(second.chapter)) ||
        first.chapter.localeCompare(second.chapter),
    );
}

function TypeCard({
  onSelect,
  rows,
}: {
  onSelect: (eventType: TimelineEventType) => void;
  rows: TypeRow[];
}) {
  const t = useTranslations("timeline.overview");
  const tType = useTranslations("timeline.eventType");
  const page = useOverviewPage(rows);
  const max = maxCount(rows.map((row) => row.count));

  return (
    <TimelineOverviewCard
      action={
        <TimelineOverviewPagination
          canNext={page.canNext}
          canPrev={page.canPrev}
          from={page.from}
          onNext={page.next}
          onPrev={page.prev}
          to={page.to}
          total={page.total}
        />
      }
      title={t("byType")}
    >
      {rows.length === 0 ? (
        <CardEmpty />
      ) : (
        page.items.map((row) => (
          <TimelineOverviewRow
            count={row.count}
            icon={
              <UiIcon className="text-icon" name={EVENT_TYPE_META[row.eventType].icon} size={14} />
            }
            key={row.eventType}
            label={tType(row.eventType)}
            max={max}
            onSelect={() => onSelect(row.eventType)}
          />
        ))
      )}
    </TimelineOverviewCard>
  );
}
