"use client";

import type {
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
  delta: Nullable<NumericDelta>;
  icon: UiIconName;
  isMoney: boolean;
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

  const cards: KpiCard[] = [
    {
      caption: captionOfOtherCurrencies(summary.totalsByCurrency, currency, locale),
      delta: currencyDeltaOf(comparison?.totalsByCurrency, currency),
      icon: "wallet",
      isMoney: true,
      key: "spend",
      microfact: null,
      tone: "primary",
      value: currencyTotalOf(summary.totalsByCurrency, currency),
    },
    {
      caption: captionOfOtherCurrencies(snapshot.activeTotalsByCurrency, currency, locale),
      delta: null,
      icon: "truck",
      isMoney: true,
      key: "snapshot",
      microfact: t("snapshotFact", {
        books: snapshot.activeBooksCount,
        shipments: snapshot.activeShipmentsCount,
      }),
      tone: "info",
      value: currencyTotalOf(snapshot.activeTotalsByCurrency, currency),
    },
    {
      caption: null,
      delta: currencyDeltaOf(comparison?.averageBookPriceByCurrency, currency),
      icon: "book",
      isMoney: true,
      key: "average",
      microfact: null,
      tone: "genre",
      value: currencyAverageOf(summary.averageBookPriceByCurrency, currency),
    },
    {
      caption: null,
      delta: currencyDeltaOf(comparison?.averageOrderAmountByCurrency, currency),
      icon: "cart",
      isMoney: true,
      key: "basket",
      microfact:
        summary.averageBooksPerOrder === null
          ? null
          : t("booksPerOrder", {
              value: formatNumber(summary.averageBooksPerOrder, locale, {
                maximumFractionDigits: 1,
              }),
            }),
      tone: "tag",
      value: currencyAverageOf(summary.averageOrderAmountByCurrency, currency),
    },
  ];

  const secondary = [
    { delta: comparison?.ordersCount ?? null, key: "orders", value: summary.ordersCount },
    { delta: comparison?.booksCount ?? null, key: "books", value: summary.booksCount },
    { delta: comparison?.shipmentsCount ?? null, key: "shipments", value: summary.shipmentsCount },
    {
      delta: comparison?.receivedBooksCount ?? null,
      key: "received",
      value: summary.receivedBooksCount,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const delta = toDeltaView(card.delta);
          const value = money(card.value) ?? EMPTY_VALUE;
          return (
            <StatCard
              caption={card.caption ?? undefined}
              icon={card.icon}
              iconTone={card.tone}
              key={card.key}
              label={
                <span className="inline-flex items-center gap-1.5">
                  {t(`${card.key}.label`)}
                  <KpiHint text={t(`${card.key}.hint`)} />
                </span>
              }
              microfact={
                <span className="flex flex-col gap-1">
                  {card.key === "snapshot" ? (
                    <span className="w-fit rounded-full bg-info-soft px-2 py-0.5 text-[0.6875rem] font-medium text-info">
                      {t("snapshotBadge")}
                    </span>
                  ) : null}
                  {card.microfact}
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
        })}
      </div>

      <ul className="flex flex-wrap items-center gap-2">
        {secondary.map((entry) => {
          const delta = toDeltaView(entry.delta);
          return (
            <li
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[0.8125rem]"
              key={entry.key}
            >
              <span className="text-muted-foreground">{t(`secondary.${entry.key}`)}</span>
              <span className="font-semibold text-ink tabular-nums">
                {formatNumber(entry.value, locale)}
              </span>
              <StatisticsDelta
                delta={delta}
                flatLabel=""
                previousText={
                  delta === null || delta.previous === null
                    ? null
                    : t("previousShort", { value: formatNumber(delta.previous, locale) })
                }
              />
            </li>
          );
        })}
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
