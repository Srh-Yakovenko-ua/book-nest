"use client";

import type { BookOrderStatisticsStore, Currency, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";

import type { StatisticsDrilldownFilters } from "../../model/statistics-drilldown";
import type { StoreMetric, StoreRow } from "../../model/statistics-stores";

import { formatMoney } from "../../model/money-format";
import { storeHref } from "../../model/statistics-drilldown";
import { formatPercentValue } from "../../model/statistics-format";
import { STORE_METRICS, storeRows } from "../../model/statistics-stores";
import {
  StatisticsCurrencyTabs,
  StatisticsMetricTabs,
  StatisticsSection,
} from "./statistics-section";

const VISIBLE_ROWS = 6;

export function StatisticsStores({
  comparisonStores,
  currencies,
  currency,
  drilldown,
  onCurrencyChange,
  stores,
}: {
  comparisonStores: Nullable<readonly BookOrderStatisticsStore[]>;
  currencies: readonly Currency[];
  currency: Currency;
  drilldown: StatisticsDrilldownFilters;
  onCurrencyChange: (currency: Currency) => void;
  stores: readonly BookOrderStatisticsStore[];
}) {
  const t = useTranslations("delivery.statistics.stores");
  const [metric, setMetric] = useState<StoreMetric>("spend");
  const [expanded, setExpanded] = useState(false);

  const rows = storeRows({ comparisonStores, currency, metric, stores });
  const visible = expanded ? rows : rows.slice(0, VISIBLE_ROWS);
  const isMoney = metric === "spend";

  return (
    <StatisticsSection
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <StatisticsMetricTabs
            label={t("metricLabel")}
            metrics={STORE_METRICS}
            onChange={setMetric}
            optionLabel={(value) => t(`metrics.${value}`)}
            value={metric}
          />
          {isMoney ? (
            <StatisticsCurrencyTabs
              currencies={currencies}
              label={t("currencyLabel")}
              onChange={onCurrencyChange}
              value={currency}
            />
          ) : null}
        </div>
      }
      className="h-full"
      description={t("subtitle")}
      title={t("title")}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {visible.map((row) => (
              <StoreListRow
                currency={currency}
                drilldown={drilldown}
                isMoney={isMoney}
                key={row.store}
                row={row}
              />
            ))}
          </ul>
          {rows.length > VISIBLE_ROWS ? (
            <Button
              className="self-start"
              onClick={() => setExpanded((value) => !value)}
              size="sm"
              variant="ghost"
            >
              {expanded ? t("showLess") : t("showAll", { count: rows.length })}
            </Button>
          ) : null}
        </>
      )}
    </StatisticsSection>
  );
}

function StoreDelta({ row }: { row: StoreRow }) {
  const t = useTranslations("delivery.statistics.stores");
  const locale = useLocale();

  if (row.deltaPercent === null || row.deltaValue === null || row.deltaValue === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        className="inline-flex cursor-help items-center gap-0.5 text-xs text-muted-foreground tabular-nums"
        type="button"
      >
        <UiIcon name={row.deltaValue > 0 ? "arrow-up" : "arrow-down"} size={11} />
        {formatPercentValue(Math.abs(row.deltaPercent), locale)}
      </TooltipTrigger>
      <TooltipContent>
        {t("deltaHint", { value: formatNumber(Math.abs(row.deltaValue), locale) })}
      </TooltipContent>
    </Tooltip>
  );
}

function StoreListRow({
  currency,
  drilldown,
  isMoney,
  row,
}: {
  currency: Currency;
  drilldown: StatisticsDrilldownFilters;
  isMoney: boolean;
  row: StoreRow;
}) {
  const t = useTranslations("delivery.statistics.stores");
  const locale = useLocale();
  const value = isMoney
    ? formatMoney({ amount: row.value, currency, locale })
    : formatNumber(row.value, locale);

  const details = [
    t("counts", { books: row.booksCount, orders: row.ordersCount }),
    row.averageBookPrice === null
      ? null
      : t("perBook", { value: formatMoney({ amount: row.averageBookPrice, currency, locale }) }),
    row.averageOrderAmount === null
      ? null
      : t("perOrder", {
          value: formatMoney({ amount: row.averageOrderAmount, currency, locale }),
        }),
  ].filter((entry): entry is string => entry !== null);

  return (
    <li className="flex flex-col gap-1.5">
      <Link
        className="flex cursor-pointer flex-col gap-1.5 rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        href={storeHref(row.store, {
          ...drilldown,
          currency: isMoney ? currency : drilldown.currency,
        })}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{row.store}</span>
          <span className="flex shrink-0 items-baseline gap-1.5">
            <span className="text-sm font-semibold text-ink tabular-nums">{value}</span>
            <StoreDelta row={row} />
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary/70"
            style={{ width: `${Math.max(row.share * 100, 4)}%` }}
          />
        </div>
      </Link>
      <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {details.join(" · ")}
        {row.averageLandedBookCost === null ? null : (
          <Tooltip>
            <TooltipTrigger
              aria-label={t("landedHint")}
              className="cursor-help underline decoration-dotted underline-offset-2"
              type="button"
            >
              {t("landed", {
                value: formatMoney({ amount: row.averageLandedBookCost, currency, locale }),
              })}
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{t("landedHint")}</TooltipContent>
          </Tooltip>
        )}
      </span>
    </li>
  );
}
