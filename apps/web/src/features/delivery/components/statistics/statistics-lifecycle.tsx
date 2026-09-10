"use client";

import type {
  BookOrderDerivedStatus,
  BookOrderStatisticsLifecycle,
  Nullable,
  StatisticsPeriod,
} from "@app/shared";

import { STATISTICS_METRIC_KIND, statisticsDrilldownDestinationOf } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";
import type { LifecycleMode, LifecycleRow } from "../../model/statistics-lifecycle";

import { buildStatisticsDrilldown } from "../../model/statistics-drilldown";
import { formatPercentValue } from "../../model/statistics-format";
import { LIFECYCLE_MODES, lifecycleBreakdown } from "../../model/statistics-lifecycle";
import { StatisticsMetricTabs, StatisticsSection } from "./statistics-section";
import { StatisticsSectionState } from "./statistics-states";

const PERCENT_MULTIPLIER = 100;

const ROW_SHELL = "flex flex-col gap-1.5 rounded-md px-2 py-1.5";

const STAGE_ICON = {
  active: "clock",
  cancelled: "x-circle",
  partially_received: "package-check",
  partially_shipped: "boxes",
  received: "check-circle",
  shipped: "truck",
} as const satisfies Record<BookOrderDerivedStatus, UiIconName>;

export function StatisticsLifecycle({
  comparisonLabel,
  currentLabel,
  drilldown,
  includeCancelled,
  lifecycle,
  period,
}: {
  comparisonLabel: Nullable<string>;
  currentLabel: Nullable<string>;
  drilldown: StatisticsDrilldownContext;
  includeCancelled: boolean;
  lifecycle: BookOrderStatisticsLifecycle;
  period: StatisticsPeriod;
}) {
  const t = useTranslations("delivery.statistics.lifecycle");
  const locale = useLocale();
  const [mode, setMode] = useState<LifecycleMode>("orders");

  const breakdown = lifecycleBreakdown(lifecycle, mode);
  const rowDrilldown = mode === "orders" ? drilldown : null;

  return (
    <StatisticsSection
      action={
        <StatisticsMetricTabs
          label={t("modeLabel")}
          metrics={LIFECYCLE_MODES}
          onChange={setMode}
          optionLabel={(value) => t(`modes.${value}`)}
          value={mode}
        />
      }
      className="h-full"
      contentClassName="grow"
      description={t(`subtitles.${mode}`, { period: currentLabel ?? t("allTime") })}
      title={t("title")}
    >
      {breakdown.total === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <>
          <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
            <p>
              {t.rich(`totals.${mode}`, {
                count: breakdown.total,
                value: (chunks) => (
                  <span className="font-medium text-foreground tabular-nums">{chunks}</span>
                ),
              })}
            </p>
            {breakdown.hasComparison && comparisonLabel !== null ? (
              <p>{t("comparedTo", { period: comparisonLabel })}</p>
            ) : null}
          </div>

          <ul className="-mx-2 flex grow flex-col justify-between">
            {breakdown.stages.map((row) => (
              <StageRow
                drilldown={rowDrilldown}
                key={row.stage}
                locale={locale}
                mode={mode}
                period={period}
                row={row}
              />
            ))}
          </ul>

          <div className="border-t border-border pt-2">
            <ul className="-mx-2 flex flex-col">
              {includeCancelled ? (
                <StageRow
                  drilldown={rowDrilldown}
                  locale={locale}
                  mode={mode}
                  period={period}
                  row={breakdown.cancelled}
                />
              ) : (
                <CancelledExcludedRow />
              )}
            </ul>
          </div>
        </>
      )}
    </StatisticsSection>
  );
}

function CancelledExcludedRow() {
  const t = useTranslations("delivery.statistics.lifecycle");

  return (
    <li className={cn(ROW_SHELL, "flex-row items-center justify-between gap-3")}>
      <StageLabel className="font-normal text-muted-foreground" stage="cancelled" />
      <span className="shrink-0 text-xs text-muted-foreground">{t("cancelledExcluded")}</span>
    </li>
  );
}

function LifecycleDelta({
  locale,
  mode,
  row,
}: {
  locale: string;
  mode: LifecycleMode;
  row: LifecycleRow;
}) {
  const t = useTranslations("delivery.statistics.lifecycle");
  const { delta, previous } = row;

  if (delta === null || previous === null) return null;

  const signed = formatNumber(delta, locale, { signDisplay: "exceptZero" });

  return (
    <TooltipHint
      label={
        <span className="flex flex-col gap-0.5">
          <span>{t(`delta.previous.${mode}`, { count: previous })}</span>
          <span>
            {t("delta.current", { count: formatNumber(row.count, locale), delta: signed })}
          </span>
        </span>
      }
    >
      <button
        className="relative cursor-default rounded-sm text-xs whitespace-nowrap text-muted-foreground tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        type="button"
      >
        {delta === 0 ? t("delta.noChange") : signed}
      </button>
    </TooltipHint>
  );
}

function StageLabel({ className, stage }: { className?: string; stage: BookOrderDerivedStatus }) {
  const t = useTranslations("delivery.statistics.lifecycle");
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground",
        className,
      )}
    >
      <UiIcon aria-hidden className="shrink-0 text-primary" name={STAGE_ICON[stage]} size={14} />
      <span className="line-clamp-2">{t(`statuses.${stage}`)}</span>
    </span>
  );
}

function StageRow({
  drilldown,
  locale,
  mode,
  period,
  row,
}: {
  drilldown: Nullable<StatisticsDrilldownContext>;
  locale: string;
  mode: LifecycleMode;
  period: StatisticsPeriod;
  row: LifecycleRow;
}) {
  const t = useTranslations("delivery.statistics.lifecycle");

  const href =
    drilldown === null || row.count === 0
      ? null
      : buildStatisticsDrilldown({
          context: { ...drilldown, orderState: row.stage },
          destination: statisticsDrilldownDestinationOf(row.stage),
          metricKind: STATISTICS_METRIC_KIND.countOrStatus,
          scope: { from: period.from, kind: "order_date_range", to: period.to },
        });

  return (
    <li
      className={cn(
        ROW_SHELL,
        "group relative",
        href !== null &&
          "transition-colors hover:bg-accent/60 has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50",
      )}
    >
      {href === null ? null : (
        <Link className="absolute inset-0 cursor-pointer rounded-md outline-none" href={href}>
          <span className="sr-only">{t(`statuses.${row.stage}`)}</span>
        </Link>
      )}
      <div className="flex items-center justify-between gap-3">
        <StageLabel stage={row.stage} />
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-ink tabular-nums">
              {formatNumber(row.count, locale)}
            </span>
            <span className="text-xs text-muted-foreground">{t(`units.${mode}`)}</span>
            <span aria-hidden className="text-xs text-muted-foreground">
              ·
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatPercentValue(row.totalShare * PERCENT_MULTIPLIER, locale)}
            </span>
          </span>
          <LifecycleDelta locale={locale} mode={mode} row={row} />
          <span className="flex w-3.5 shrink-0 justify-end">
            {href === null ? null : (
              <UiIcon
                aria-hidden
                className="text-muted-foreground/60 transition-colors group-hover:text-foreground group-has-[a:focus-visible]:text-foreground"
                name="chevron-right"
                size={14}
              />
            )}
          </span>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary/70"
          style={{ width: `${row.totalShare * PERCENT_MULTIPLIER}%` }}
        />
      </div>
    </li>
  );
}
