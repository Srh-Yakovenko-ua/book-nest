"use client";

import type {
  Nullable,
  TimelineColorKey,
  TimelineEventType,
  TimelineImportance,
  TimelineOverviewView as TimelineOverview,
} from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { markerClass } from "../model/color-key";
import { eventTypeMeta } from "../model/event-type-meta";

type DistributionRowProps = {
  count: number;
  icon?: ReactNode;
  label: string;
  locale: string;
  max: number;
  onSelect?: () => void;
  swatch?: ReactNode;
};

type TimelineOverviewViewProps = {
  onSelectLine: (timelineId: string) => void;
  onSelectType: (type: TimelineEventType) => void;
  overview: TimelineOverview;
};

export function TimelineOverviewView({
  onSelectLine,
  onSelectType,
  overview,
}: TimelineOverviewViewProps) {
  const t = useTranslations("timeline");
  const tType = useTranslations("timeline.eventType");
  const tImportance = useTranslations("timeline.importance");
  const locale = useLocale();

  if (overview.totalEvents === 0) {
    return <p className="text-sm text-muted-foreground">{t("overview.empty")}</p>;
  }

  const typeMax = maxCount(overview.byType.map((item) => item.count));
  const importanceMax = maxCount(overview.byImportance.map((item) => item.count));
  const lineMax = maxCount(overview.byTimeline.map((item) => item.count));
  const chapterMax = maxCount(overview.chapterDensity.map((item) => item.count));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatCard label={t("overview.totalEvents")} locale={locale} value={overview.totalEvents} />
        <StatCard
          label={t("overview.unresolved")}
          locale={locale}
          value={overview.unresolvedCount}
        />
        {overview.readingPosition.positionKnown ? (
          <>
            <StatCard
              label={t("overview.eventsBefore")}
              locale={locale}
              value={overview.eventsBeforePosition}
            />
            <StatCard
              label={t("overview.eventsAfter")}
              locale={locale}
              value={overview.eventsAfterPosition}
            />
          </>
        ) : null}
      </div>

      <Section title={t("overview.byType")}>
        {overview.byType.map((item) => (
          <DistributionRow
            count={item.count}
            icon={
              <UiIcon className="text-icon" name={eventTypeMeta(item.eventType).icon} size={14} />
            }
            key={item.eventType}
            label={tType(item.eventType)}
            locale={locale}
            max={typeMax}
            onSelect={() => onSelectType(item.eventType)}
          />
        ))}
      </Section>

      <Section title={t("overview.byImportance")}>
        {overview.byImportance.map((item) => (
          <DistributionRow
            count={item.count}
            key={item.importance}
            label={tImportance(item.importance)}
            locale={locale}
            max={importanceMax}
            swatch={<ImportanceSwatch importance={item.importance} />}
          />
        ))}
      </Section>

      {overview.byTimeline.length > 1 ? (
        <Section title={t("overview.byLine")}>
          {overview.byTimeline.map((item) => (
            <DistributionRow
              count={item.count}
              key={item.timelineId}
              label={item.timelineName}
              locale={locale}
              max={lineMax}
              onSelect={() => onSelectLine(item.timelineId)}
              swatch={<ColorDot colorKey={item.colorKey} />}
            />
          ))}
        </Section>
      ) : null}

      <Section title={t("overview.chapterDensity")}>
        {overview.chapterDensity.map((item) => (
          <DistributionRow
            count={item.count}
            key={item.chapter ?? "__none__"}
            label={item.chapter ?? t("noChapter")}
            locale={locale}
            max={chapterMax}
          />
        ))}
      </Section>
    </div>
  );
}

function ColorDot({ colorKey }: { colorKey: Nullable<TimelineColorKey> }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", markerClass(colorKey))} />;
}

function DistributionRow({
  count,
  icon,
  label,
  locale,
  max,
  onSelect,
  swatch,
}: DistributionRowProps) {
  const width = max > 0 ? (count / max) * 100 : 0;
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-foreground">
          {icon}
          {swatch}
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
          {formatNumber(count, locale)}
        </span>
      </div>
      <div aria-hidden className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${width}%` }}
        />
      </div>
    </>
  );

  if (onSelect === undefined) {
    return <div className="flex flex-col gap-1.5 p-1">{content}</div>;
  }

  return (
    <button
      className="flex cursor-pointer flex-col gap-1.5 rounded-md p-1 text-left transition-colors outline-none hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50"
      onClick={onSelect}
      type="button"
    >
      {content}
    </button>
  );
}

function ImportanceSwatch({ importance }: { importance: TimelineImportance }) {
  const tone: Record<TimelineImportance, string> = {
    high: "bg-warning",
    key: "bg-brand",
    low: "bg-muted-foreground/40",
    medium: "bg-muted-foreground",
  };
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", tone[importance])} />;
}

function maxCount(counts: number[]): number {
  return counts.reduce((max, value) => (value > max ? value : max), 0);
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function StatCard({ label, locale, value }: { label: string; locale: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-background p-3">
      <span className="text-xl font-semibold text-foreground tabular-nums">
        {formatNumber(value, locale)}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}
