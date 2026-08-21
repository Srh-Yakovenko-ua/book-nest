"use client";

import type { BookOrderStatisticsRecords, Currency, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";

import type { StatisticsDrilldownFilters } from "../../model/statistics-drilldown";

import { formatMoney } from "../../model/money-format";
import { monthHref, orderHref, storeHref } from "../../model/statistics-drilldown";
import { monthLabel } from "../../model/statistics-dynamics";
import { StatisticsCurrencyTabs, StatisticsSection } from "./statistics-section";

type RecordRow = {
  helper: Nullable<string>;
  href: Nullable<string>;
  icon: UiIconName;
  key: string;
  title: string;
  value: ReactNode;
};

export function StatisticsRecords({
  currencies,
  currency,
  drilldown,
  onCurrencyChange,
  records,
}: {
  currencies: readonly Currency[];
  currency: Currency;
  drilldown: StatisticsDrilldownFilters;
  onCurrencyChange: (currency: Currency) => void;
  records: BookOrderStatisticsRecords;
}) {
  const t = useTranslations("delivery.statistics.records");
  const locale = useLocale();

  const money = (amount: number) => formatMoney({ amount, currency, locale });

  const recordMonth = records.recordMonthByCurrency.find((entry) => entry.currency === currency);
  const largestOrder = records.largestOrderByCurrency.find((entry) => entry.currency === currency);
  const bestValue = records.bestValueStoreByCurrency.find((entry) => entry.currency === currency);
  const mostActive = records.mostActiveStore.byOrders;
  const { mostBooksInOrder } = records;

  const rows: Nullable<RecordRow>[] = [
    recordMonth === undefined
      ? null
      : {
          helper: t("recordMonth.helper", {
            books: recordMonth.booksCount,
            orders: recordMonth.ordersCount,
          }),
          href: monthHref(recordMonth.month, drilldown),
          icon: "flame",
          key: "recordMonth",
          title: t("recordMonth.title"),
          value: `${monthLabel(recordMonth.month, locale, true)} · ${money(recordMonth.total)}`,
        },
    largestOrder === undefined
      ? null
      : {
          helper: t("largestOrder.helper", {
            books: largestOrder.order.booksCount,
            store: largestOrder.order.storeName,
          }),
          href: orderHref(largestOrder.order),
          icon: "trophy",
          key: "largestOrder",
          title: t("largestOrder.title"),
          value: money(largestOrder.order.totalAmount),
        },
    mostBooksInOrder === null
      ? null
      : {
          helper: t("mostBooks.helper", { store: mostBooksInOrder.storeName }),
          href: orderHref(mostBooksInOrder),
          icon: "library",
          key: "mostBooks",
          title: t("mostBooks.title"),
          value: t("mostBooks.value", { count: mostBooksInOrder.booksCount }),
        },
    mostActive === null
      ? null
      : {
          helper: t("mostActive.helper", { books: mostActive.booksCount }),
          href: storeHref(mostActive.store, drilldown),
          icon: "store",
          key: "mostActive",
          title: t("mostActive.title"),
          value: t("mostActive.value", { count: mostActive.ordersCount, store: mostActive.store }),
        },
    bestValue === undefined
      ? null
      : {
          helper: t("bestValue.helper", { count: bestValue.eligibleBooksCount }),
          href: storeHref(bestValue.store, { ...drilldown, currency }),
          icon: "sparkles",
          key: "bestValue",
          title: t("bestValue.title"),
          value: `${bestValue.store} · ${money(bestValue.averageLandedBookCost)}`,
        },
  ];

  const visible = rows.filter((row): row is RecordRow => row !== null);
  const scopeNote = records.scope.isTruncated
    ? t("scope.truncated")
    : records.scope.isPeriodFiltered
      ? t("scope.period")
      : t("scope.allTime");

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
      className="h-full"
      description={scopeNote}
      title={t("title")}
    >
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {visible.map((row) => (
            <li className="py-2.5 first:pt-0 last:pb-0" key={row.key}>
              <RecordEntry locale={locale} row={row} />
            </li>
          ))}
        </ul>
      )}
    </StatisticsSection>
  );
}

function RecordEntry({ locale, row }: { locale: string; row: RecordRow }) {
  const body = (
    <>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-icon">
        <UiIcon name={row.icon} size={16} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{row.title}</span>
        <span className="truncate text-sm font-semibold text-ink">{row.value}</span>
        {row.helper === null ? null : (
          <span className="text-xs text-muted-foreground">{row.helper}</span>
        )}
      </span>
      {row.href === null ? null : (
        <UiIcon className="shrink-0 text-icon" name="chevron-right" size={16} />
      )}
    </>
  );

  if (row.href === null) {
    return <span className="flex items-center gap-3">{body}</span>;
  }

  return (
    <Link
      className="flex cursor-pointer items-center gap-3 rounded-md transition-colors outline-none hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50"
      href={row.href}
      lang={locale}
    >
      {body}
    </Link>
  );
}
