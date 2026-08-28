"use client";

import type {
  BookOrderStatisticsFinancialCoverage,
  BookOrderStatisticsSnapshot,
  BookOrderStatisticsView,
  Currency,
  Nullable,
  NumericDelta,
} from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";
import type { StatCardIconTone } from "@/components/ui/stat-card";

import { UiIcon } from "@/components/icons";
import { StatCard } from "@/components/ui/stat-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatNumber } from "@/lib/format";

import { formatMoney } from "../../model/money-format";
import {
  currencyAverageOf,
  currencyDeltaOf,
  currencyTotalOf,
  otherCurrencyTotals,
} from "../../model/statistics-currency";
import { toDeltaView } from "../../model/statistics-view-model";
import { StatisticsDelta } from "./statistics-delta";

const KPI_VALUE = {
  compactFromLength: 11,
  empty: "—",
} as const;

const EMPTY_VALUE = KPI_VALUE.empty;

type KpiCard = {
  caption: Nullable<string>;
  coverage: Nullable<string>;
  delta: Nullable<NumericDelta>;
  icon: UiIconName;
  isMoney: boolean;
  isSnapshot: boolean;
  key: "average" | "basket" | "snapshot" | "spend";
  microfact: Nullable<ReactNode>;
  tone: StatCardIconTone;
  value: Nullable<number>;
};

export function StatisticsKpi({
  currency,
  snapshot,
  view,
}: {
  currency: Currency;
  snapshot: BookOrderStatisticsSnapshot;
  view: BookOrderStatisticsView;
}) {
  const t = useTranslations("delivery.statistics.kpi");
  const locale = useLocale();
  const { comparison, summary } = view;

  const money = (amount: Nullable<number>) =>
    amount === null ? null : formatMoney({ amount, currency, locale });

  const financialCoverage = coverageOf(summary.financialCoverageByCurrency, currency);
  const activeCoverage = coverageOf(snapshot.activeMoneyCoverageByCurrency, currency);
  const priceCoverage = summary.priceCoverageByCurrency.find(
    (entry) => entry.currency === currency,
  );

  const cards: KpiCard[] = [
    {
      caption: captionOfOtherCurrencies(summary.totalsByCurrency, currency, locale),
      coverage:
        unresolvedOf(financialCoverage) === 0
          ? null
          : t("coverage.unresolvedOrders", {
              count: unresolvedOf(financialCoverage),
            }),
      delta: currencyDeltaOf(comparison?.totalsByCurrency, currency),
      icon: "wallet",
      isMoney: true,
      isSnapshot: false,
      key: "spend",
      microfact: null,
      tone: "primary",
      value: currencyTotalOf(summary.totalsByCurrency, currency),
    },
    {
      caption: null,
      coverage:
        priceCoverage === undefined || priceCoverage.booksWithPrice === priceCoverage.booksInScope
          ? null
          : t("coverage.pricedBooks", {
              counted: priceCoverage.booksWithPrice,
              total: priceCoverage.booksInScope,
            }),
      delta: currencyDeltaOf(comparison?.averageBookPriceByCurrency, currency),
      icon: "book",
      isMoney: true,
      isSnapshot: false,
      key: "average",
      microfact: t("average.helper"),
      tone: "genre",
      value: currencyAverageOf(summary.averageBookPriceByCurrency, currency),
    },
    {
      caption: null,
      coverage:
        financialCoverage === null ||
        financialCoverage.ordersWithResolvedAmount === financialCoverage.ordersInScope
          ? null
          : t("coverage.resolvedOrders", {
              counted: financialCoverage.ordersWithResolvedAmount,
              total: financialCoverage.ordersInScope,
            }),
      delta: currencyDeltaOf(comparison?.averageOrderAmountByCurrency, currency),
      icon: "cart",
      isMoney: true,
      isSnapshot: false,
      key: "basket",
      microfact: null,
      tone: "tag",
      value: currencyAverageOf(summary.averageOrderAmountByCurrency, currency),
    },
    {
      caption: captionOfOtherCurrencies(snapshot.activeTotalsByCurrency, currency, locale),
      coverage:
        unresolvedOf(activeCoverage) === 0
          ? null
          : t("coverage.unresolvedActive", {
              count: unresolvedOf(activeCoverage),
            }),
      delta: null,
      icon: "truck",
      isMoney: true,
      isSnapshot: true,
      key: "snapshot",
      microfact: t("snapshotFact", {
        books: snapshot.activeBooksCount,
        orders: snapshot.activeOrdersCount,
        shipments: snapshot.activeShipmentsCount,
      }),
      tone: "info",
      value: currencyTotalOf(snapshot.activeTotalsByCurrency, currency),
    },
  ];

  const secondary = [
    { delta: comparison?.ordersCount ?? null, key: "orders", value: summary.ordersCount },
    { delta: comparison?.booksCount ?? null, key: "books", value: summary.booksCount },
    {
      delta: comparison?.averageBooksPerOrder ?? null,
      key: "booksPerOrder",
      value: summary.averageBooksPerOrder,
    },
    { delta: comparison?.shipmentsCount ?? null, key: "shipments", value: summary.shipmentsCount },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div className="flex flex-col gap-1" key={card.key}>
            <span className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
              {t(card.isSnapshot ? "scope.now" : "scope.period")}
            </span>
            <KpiCardBody card={card} currency={currency} money={money} />
          </div>
        ))}
      </div>

      <ul className="flex flex-wrap items-center gap-2">
        {secondary.map((entry) => (
          <SecondaryChip
            delta={entry.delta}
            key={entry.key}
            label={t(`secondary.${entry.key}`)}
            value={entry.value}
          />
        ))}
      </ul>
    </div>
  );
}

function captionOfOtherCurrencies(
  totals: readonly { currency: Currency; total: number }[],
  currency: Currency,
  locale: string,
): Nullable<string> {
  const others = otherCurrencyTotals(totals, currency);
  if (others.length === 0) return null;
  return others
    .map((entry) => formatMoney({ amount: entry.total, currency: entry.currency, locale }))
    .join(" · ");
}

function coverageOf(
  rows: readonly BookOrderStatisticsFinancialCoverage[],
  currency: Currency,
): Nullable<BookOrderStatisticsFinancialCoverage> {
  return rows.find((entry) => entry.currency === currency) ?? null;
}

function KpiCardBody({
  card,
  currency,
  money,
}: {
  card: KpiCard;
  currency: Currency;
  money: (amount: Nullable<number>) => Nullable<string>;
}) {
  const t = useTranslations("delivery.statistics.kpi");
  const locale = useLocale();
  const delta = toDeltaView(card.delta);
  const value = money(card.value) ?? EMPTY_VALUE;

  return (
    <StatCard
      caption={card.caption ?? undefined}
      icon={card.icon}
      iconTone={card.tone}
      label={
        <span className="inline-flex items-center gap-1.5">
          {t(`${card.key}.label`)}
          <KpiHint text={t(`${card.key}.hint`)} />
        </span>
      }
      microfact={
        <span className="flex flex-col gap-1">
          {card.isSnapshot ? (
            <span className="w-fit rounded-full bg-info-soft px-2 py-0.5 text-[0.6875rem] font-medium text-info">
              {t("snapshotBadge")}
            </span>
          ) : null}
          {card.microfact}
          {card.value === null ? (
            <span className="text-xs text-muted-foreground">
              {t("missingForCurrency", { currency })}
            </span>
          ) : null}
          {card.coverage === null ? null : (
            <span className="text-xs text-muted-foreground">{card.coverage}</span>
          )}
          <StatisticsDelta
            delta={delta}
            flatLabel={t("noChange")}
            previousText={
              delta?.previous === null || delta === null
                ? null
                : t("previous", {
                    value: card.isMoney
                      ? formatMoney({ amount: delta.previous, currency, locale })
                      : formatNumber(delta.previous, locale),
                  })
            }
          />
        </span>
      }
      value={value}
      valueClassName={
        value.length < KPI_VALUE.compactFromLength
          ? "whitespace-nowrap"
          : "text-2xl whitespace-nowrap"
      }
    />
  );
}

function KpiHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={text}
        className="cursor-help text-muted-foreground transition-colors hover:text-foreground"
        type="button"
      >
        <UiIcon name="info" size={13} />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  );
}

function SecondaryChip({
  delta,
  label,
  value,
}: {
  delta: Nullable<NumericDelta>;
  label: string;
  value: Nullable<number>;
}) {
  const t = useTranslations("delivery.statistics.kpi");
  const locale = useLocale();
  const view = toDeltaView(delta);
  const previous =
    view === null || view.previous === null
      ? null
      : t("previousShort", { value: formatNumber(view.previous, locale) });
  const chip = (
    <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[0.8125rem]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-ink tabular-nums">
        {value === null ? EMPTY_VALUE : formatNumber(value, locale, { maximumFractionDigits: 1 })}
      </span>
      <StatisticsDelta delta={view} flatLabel="" previousText={null} />
    </li>
  );

  if (previous === null) {
    return chip;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent>{previous}</TooltipContent>
    </Tooltip>
  );
}

function unresolvedOf(coverage: Nullable<BookOrderStatisticsFinancialCoverage>): number {
  return coverage === null ? 0 : coverage.ordersInScope - coverage.ordersWithResolvedAmount;
}
