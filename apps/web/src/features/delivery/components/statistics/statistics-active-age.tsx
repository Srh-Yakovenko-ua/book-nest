"use client";

import type { ActiveMoneyAgeResponse } from "@app/shared";

import { STATISTICS_METRIC_KIND } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TooltipHint } from "@/components/tooltip-hint";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import type { ActiveAgeRow } from "../../model/statistics-active-age";
import type { StatisticsDrilldownContext } from "../../model/statistics-drilldown";
import type { StatisticsScopeState } from "../../model/statistics-scope-state";

import { formatCurrencyTotals } from "../../model/money-format";
import { ACTIVE_AGE_PRESENTATION, activeAgeBreakdown } from "../../model/statistics-active-age";
import { buildStatisticsDrilldown } from "../../model/statistics-drilldown";
import { formatPercentValue } from "../../model/statistics-format";
import { StatisticsSection } from "./statistics-section";
import { StatisticsSectionState, StatisticsTruncationNotice } from "./statistics-states";

const PERCENT_MULTIPLIER = 100;

const SKELETON_ROWS = 4;

const METADATA_SEPARATOR = " · ";

const ROW_SHELL = "relative flex flex-col gap-2 rounded-md px-2";

export function StatisticsActiveAge({
  drilldown,
  scope,
}: {
  drilldown: StatisticsDrilldownContext;
  scope: StatisticsScopeState<ActiveMoneyAgeResponse>;
}) {
  const t = useTranslations("delivery.statistics.activeAge");
  const locale = useLocale();

  const data = scope.data;

  return (
    <StatisticsSection
      className="h-full"
      contentClassName="grow"
      description={t("subtitle")}
      snapshotLabel={
        data === undefined ? undefined : t("asOf", { value: formatDate(data.asOf, locale) })
      }
      title={t("title")}
    >
      {scope.isInitialLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton className="h-14 w-full rounded-lg" key={index} />
          ))}
        </div>
      ) : scope.isInitialError || data === undefined ? (
        <StatisticsSectionState
          action={
            <Button onClick={scope.retry} size="sm" variant="secondary">
              {t("retry")}
            </Button>
          }
          kind="error"
          title={t("error")}
        />
      ) : (
        <ActiveAgeContent data={data} drilldown={drilldown} />
      )}
    </StatisticsSection>
  );
}

function ActiveAgeContent({
  data,
  drilldown,
}: {
  data: ActiveMoneyAgeResponse;
  drilldown: StatisticsDrilldownContext;
}) {
  const t = useTranslations("delivery.statistics.activeAge");
  const breakdown = activeAgeBreakdown(data);

  if (breakdown.total === 0) {
    return (
      <StatisticsSectionState
        description={t("empty.description")}
        kind="empty"
        title={t("empty.title")}
      />
    );
  }

  return (
    <>
      {data.source.isTruncated && data.source.maxOrders !== null ? (
        <StatisticsTruncationNotice
          loadedOrdersCount={data.source.loadedOrdersCount}
          maxOrders={data.source.maxOrders}
        />
      ) : null}

      <ul className="-mx-2 flex flex-col">
        {breakdown.dated.map((row) => (
          <AgeBucketRow drilldown={drilldown} key={row.key} row={row} />
        ))}
      </ul>

      {breakdown.unknown === null ? null : (
        <div className="mt-auto border-t border-border pt-2">
          <ul className="-mx-2 flex flex-col">
            <AgeBucketRow drilldown={drilldown} row={breakdown.unknown} />
          </ul>
        </div>
      )}
    </>
  );
}

function AgeBucketRow({
  drilldown,
  row,
}: {
  drilldown: StatisticsDrilldownContext;
  row: ActiveAgeRow;
}) {
  const t = useTranslations("delivery.statistics.activeAge");
  const locale = useLocale();

  const isUndated = row.key === ACTIVE_AGE_PRESENTATION.unknownKey;
  const label = t(`buckets.${row.key}`);
  const href = row.isEmpty
    ? null
    : buildStatisticsDrilldown({
        context: drilldown,
        destination: "in_transit",
        metricKind: STATISTICS_METRIC_KIND.countOrStatus,
        scope: { ageBucket: row.key, kind: "age_bucket" },
      });

  return (
    <li
      className={cn(
        ROW_SHELL,
        isUndated ? "py-2" : "py-1.5",
        href !== null &&
          "group transition-colors hover:bg-accent/60 has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50",
      )}
    >
      {href === null ? null : (
        <Link className="absolute inset-0 cursor-pointer rounded-md outline-none" href={href}>
          <span className="sr-only">{label}</span>
        </Link>
      )}

      <div className="flex items-start gap-2.5">
        <UiIcon
          aria-hidden
          className={cn("mt-0.5", row.isEmpty ? "text-muted-foreground" : "text-primary")}
          name={
            isUndated ? ACTIVE_AGE_PRESENTATION.icon.unknown : ACTIVE_AGE_PRESENTATION.icon.dated
          }
          size={15}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "line-clamp-2 text-sm font-medium",
                  row.isEmpty ? "text-muted-foreground" : "text-foreground",
                )}
              >
                {label}
              </span>
              {isUndated ? <RowHint label={t("unknownHint")} name={t("unknownHintLabel")} /> : null}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("counts", { books: row.booksCount, orders: row.ordersCount })}
              {row.shipmentsCount === 0
                ? null
                : `${METADATA_SEPARATOR}${t("shipments", { count: row.shipmentsCount })}`}
            </span>
          </span>

          {row.isEmpty ? null : (
            <span className="flex shrink-0 items-start gap-1.5 sm:justify-end">
              <span className="text-sm font-semibold text-balance text-ink tabular-nums sm:text-end">
                {formatCurrencyTotals(row.totalsByCurrency, locale)}
              </span>
              <RowHint label={t("moneyHint")} name={t("moneyHintLabel")} />
            </span>
          )}
        </div>

        <span className="flex w-3.5 shrink-0 justify-end">
          {href === null ? null : (
            <UiIcon
              aria-hidden
              className="mt-0.5 text-muted-foreground/60 transition-colors group-hover:text-foreground group-has-[a:focus-visible]:text-foreground"
              name="chevron-right"
              size={14}
            />
          )}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="h-1.5 min-w-24 flex-1 overflow-hidden rounded-full bg-secondary">
          <span
            className="block h-full rounded-full bg-primary/70"
            style={{ width: `${row.share * PERCENT_MULTIPLIER}%` }}
          />
        </span>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {t("shareOfActive", {
            value: formatPercentValue(row.share * PERCENT_MULTIPLIER, locale),
          })}
        </span>
      </div>
    </li>
  );
}

function RowHint({ label, name }: { label: string; name: string }) {
  return (
    <TooltipHint label={label}>
      <button
        aria-label={name}
        className="relative shrink-0 cursor-help rounded-sm text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        type="button"
      >
        <UiIcon aria-hidden name="info" size={13} />
      </button>
    </TooltipHint>
  );
}
