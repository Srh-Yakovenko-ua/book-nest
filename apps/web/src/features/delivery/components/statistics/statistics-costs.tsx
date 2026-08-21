"use client";

import type { BookOrderStatisticsView, Currency, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";

import { formatMoney } from "../../model/money-format";
import { currencyAverageOf } from "../../model/statistics-currency";
import { formatPercentValue } from "../../model/statistics-format";
import { StatisticsCurrencyTabs, StatisticsSection } from "./statistics-section";

export function StatisticsCosts({
  currencies,
  currency,
  deliveryShareOfBudgetPercent,
  onCurrencyChange,
  view,
}: {
  currencies: readonly Currency[];
  currency: Currency;
  deliveryShareOfBudgetPercent: Nullable<number>;
  onCurrencyChange: (currency: Currency) => void;
  view: BookOrderStatisticsView;
}) {
  const t = useTranslations("delivery.statistics.costs");
  const locale = useLocale();

  const costs = view.costs.find((entry) => entry.currency === currency) ?? null;
  const landed = view.landedCost.find((entry) => entry.currency === currency) ?? null;
  const rawAverage = currencyAverageOf(view.summary.averageBookPriceByCurrency, currency);

  const money = (amount: number) => formatMoney({ amount, currency, locale });
  const percent = (value: number) => formatPercentValue(value, locale);

  return (
    <StatisticsSection
      action={
        <StatisticsCurrencyTabs
          currencies={currencies}
          label={t("currencyLabel")}
          onChange={onCurrencyChange}
          value={currency}
        />
      }
      description={t("subtitle")}
      title={t("title")}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CostBlock
          icon="truck"
          lines={
            costs === null
              ? []
              : [
                  costs.deliveryCostPerBook === null
                    ? null
                    : t("delivery.perBook", { value: money(costs.deliveryCostPerBook) }),
                  costs.deliveryShareOfSpendPercent === null
                    ? null
                    : t("delivery.shareOfSpend", {
                        value: percent(costs.deliveryShareOfSpendPercent),
                      }),
                  deliveryShareOfBudgetPercent === null
                    ? null
                    : t("delivery.shareOfBudget", {
                        value: percent(deliveryShareOfBudgetPercent),
                      }),
                  t("delivery.orders", { count: costs.ordersWithDeliveryCount }),
                ]
          }
          title={t("delivery.title")}
          value={costs === null ? "—" : money(costs.deliveryTotal)}
        />

        <CostBlock
          icon="tag"
          lines={
            costs === null
              ? []
              : [
                  t("discount.orders", { count: costs.ordersWithDiscountCount }),
                  costs.discountShareOfRawSubtotalPercent === null
                    ? null
                    : t("discount.share", {
                        value: percent(costs.discountShareOfRawSubtotalPercent),
                      }),
                ]
          }
          title={t("discount.title")}
          value={costs === null ? "—" : money(costs.discountTotal)}
        />

        <CostBlock
          hint={t("landed.hint")}
          icon="chart"
          lines={
            landed === null
              ? []
              : [
                  landed.differenceVsAverageRawBookPrice === null || rawAverage === null
                    ? null
                    : landed.differenceVsAverageRawBookPrice < 0
                      ? t("landed.below", {
                          value: money(Math.abs(landed.differenceVsAverageRawBookPrice)),
                        })
                      : t("landed.above", {
                          value: money(landed.differenceVsAverageRawBookPrice),
                        }),
                  t("landed.coverage", {
                    counted: formatNumber(landed.eligibleBooksCount, locale),
                    eligible: formatNumber(landed.countedBooksCount, locale),
                  }),
                ]
          }
          note={
            landed !== null && landed.coveragePercent < 100
              ? t("landed.partialCoverage", { value: percent(landed.coveragePercent) })
              : null
          }
          title={t("landed.title")}
          value={
            landed === null || landed.averageLandedBookCost === null
              ? "—"
              : money(landed.averageLandedBookCost)
          }
        />
      </div>
    </StatisticsSection>
  );
}

function CostBlock({
  hint,
  icon,
  lines,
  note,
  title,
  value,
}: {
  hint?: string;
  icon: "chart" | "tag" | "truck";
  lines: Nullable<string>[];
  note?: Nullable<string>;
  title: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-field/40 p-3.5">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
        <UiIcon className="text-icon" name={icon} size={15} />
        {title}
        {hint === undefined ? null : (
          <Tooltip>
            <TooltipTrigger aria-label={hint} className="cursor-help" type="button">
              <UiIcon name="info" size={13} />
            </TooltipTrigger>
            <TooltipContent className="max-w-64">{hint}</TooltipContent>
          </Tooltip>
        )}
      </span>
      <span className="font-heading text-xl font-bold text-ink tabular-nums">{value}</span>
      <ul className="flex flex-col gap-0.5 text-[0.8125rem] text-muted-foreground">
        {lines
          .filter((line): line is string => line !== null)
          .map((line) => (
            <li key={line}>{line}</li>
          ))}
      </ul>
      {note === null || note === undefined ? null : (
        <p className="rounded-md bg-accent px-2 py-1 text-xs text-icon">{note}</p>
      )}
    </div>
  );
}
