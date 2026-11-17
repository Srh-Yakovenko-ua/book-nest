"use client";

import type {
  Nullable,
  ReadingStatisticsCalendarSection,
  StatisticsActiveDaysRate,
} from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";
import type { StatCardIconTone } from "@/components/ui/stat-card";

import { StatCard } from "@/components/ui/stat-card";

import { formatShare, weekdayLabel } from "../../model/statistics-format";

const SUMMARY_TILE = {
  activeDays: { icon: "calendar", tone: "primary" },
  activeDaysRate: { icon: "pie", tone: "info" },
  longestStreak: { icon: "flame", tone: "success" },
  mostActiveWeekday: { icon: "trophy", tone: "genre" },
} as const satisfies Record<string, SummaryTileAppearance>;

const SUMMARY_LAYOUT = {
  grid: "grid grid-cols-1 gap-2 sm:grid-cols-2",
  tile: "px-3 py-2.5 sm:px-3 sm:py-2.5",
  undeterminedValue: "text-base text-muted-foreground",
} as const;

type SummaryTileAppearance = { icon: UiIconName; tone: StatCardIconTone };

type SummaryTileContent =
  { kind: "undetermined"; reason: Nullable<string> } | { kind: "value"; value: string };

type SummaryTileKey = keyof typeof SUMMARY_TILE;

export function ReadingCalendarSummary({
  calendar,
  isLowerBound,
}: {
  calendar: ReadingStatisticsCalendarSection;
  isLowerBound: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.calendar.summary");

  const lowerBound = (value: string) => (isLowerBound ? t("lowerBoundValue", { value }) : value);
  const undetermined = (
    metric: Pick<StatisticsActiveDaysRate, "availability" | "reason">,
  ): SummaryTileContent => ({
    kind: "undetermined",
    reason:
      metric.availability === "unavailable"
        ? t(`reason.${metric.reason ?? "LEGACY_HISTORY_INCOMPLETE"}`)
        : null,
  });
  const { activeDaysPercentage, currentStreak, mostActiveWeekday } = calendar;

  const currentStreakData =
    currentStreak.availability === "unavailable" ? null : currentStreak.data;

  const tiles: { content: SummaryTileContent; key: SummaryTileKey }[] = [
    {
      content: { kind: "value", value: lowerBound(t("days", { count: calendar.activeDays })) },
      key: "activeDays",
    },
    {
      content:
        activeDaysPercentage.availability === "unavailable" || activeDaysPercentage.value === null
          ? undetermined(activeDaysPercentage)
          : {
              kind: "value",
              value: lowerBound(`${formatShare(activeDaysPercentage.value, locale)}%`),
            },
      key: "activeDaysRate",
    },
    {
      content: {
        kind: "value",
        value: lowerBound(t("days", { count: calendar.longestStreak.days })),
      },
      key: "longestStreak",
    },
    {
      content:
        mostActiveWeekday.availability === "unavailable" || mostActiveWeekday.data === null
          ? undetermined(mostActiveWeekday)
          : {
              kind: "value",
              value: weekdayLabel({ locale, weekday: mostActiveWeekday.data.weekday }),
            },
      key: "mostActiveWeekday",
    },
  ];

  return (
    <div className="flex flex-col gap-1.5">
      <div className={SUMMARY_LAYOUT.grid}>
        {tiles.map((tile) => (
          <SummaryTile
            appearance={SUMMARY_TILE[tile.key]}
            content={tile.content}
            definition={t(`definitions.${tile.key}`)}
            key={tile.key}
            label={t(tile.key)}
          />
        ))}
      </div>

      {currentStreakData === null ? null : (
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted-foreground">
          <span>
            {t.rich("currentStreakLine", {
              days: currentStreakData.continuesBeforeRange
                ? t("daysAtLeast", { count: currentStreakData.days })
                : t("days", { count: currentStreakData.days }),
              value: (chunks) => (
                <span className="font-semibold text-ink tabular-nums">{chunks}</span>
              ),
            })}
          </span>
          <span aria-hidden>·</span>
          <span>{t("currentStreakDefinition")}</span>
          {currentStreakData.continuesBeforeRange ? (
            <>
              <span aria-hidden>·</span>
              <span>{t("continuesBeforeRange")}</span>
            </>
          ) : null}
        </p>
      )}
    </div>
  );
}

function SummaryTile({
  appearance,
  content,
  definition,
  label,
}: {
  appearance: SummaryTileAppearance;
  content: SummaryTileContent;
  definition: string;
  label: string;
}) {
  const t = useTranslations("statistics.calendar.summary");

  return (
    <StatCard
      caption={content.kind === "value" ? definition : (content.reason ?? definition)}
      className={SUMMARY_LAYOUT.tile}
      icon={appearance.icon}
      iconBadgeSize="md"
      iconTone={appearance.tone}
      label={label}
      labelOverflow="wrap"
      size="compact"
      value={content.kind === "value" ? content.value : t("undetermined")}
      valueClassName={content.kind === "value" ? undefined : SUMMARY_LAYOUT.undeterminedValue}
    />
  );
}
