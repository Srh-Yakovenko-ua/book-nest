"use client";

import type { BookOrderStatisticsTopOrdersByCurrency, Currency } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";

import { formatMoney } from "../../model/money-format";
import { toOrderStatusBadge } from "../../model/order-status-badge";
import { orderHref } from "../../model/statistics-drilldown";
import { StatisticsCurrencyTabs, StatisticsSection } from "./statistics-section";

export function StatisticsTopOrders({
  currencies,
  currency,
  onCurrencyChange,
  topOrdersByCurrency,
}: {
  currencies: readonly Currency[];
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
  topOrdersByCurrency: BookOrderStatisticsTopOrdersByCurrency;
}) {
  const t = useTranslations("delivery.statistics.topOrders");
  const tStatus = useTranslations("delivery.statistics.orderStatus");
  const locale = useLocale();

  const group = topOrdersByCurrency.find((entry) => entry.currency === currency);
  const orders = group?.orders ?? [];

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
      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("emptyForCurrency", { currency })}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {orders.map((order, index) => {
            const href = orderHref(order);
            const row = (
              <>
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-ink">
                    {order.orderNumber ?? t("untitledOrder")}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <UiIcon name="store" size={12} />
                      {order.storeName}
                    </span>
                    {order.orderDate === null ? null : (
                      <span className="inline-flex items-center gap-1">
                        <UiIcon name="calendar" size={12} />
                        {formatDate(order.orderDate, locale)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <UiIcon name="book" size={12} />
                      {t("books", { count: order.booksCount })}
                    </span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-ink tabular-nums">
                    {formatMoney({ amount: order.totalAmount, currency: order.currency, locale })}
                  </span>
                  <StatusBadge entry={toOrderStatusBadge(order.derivedStatus, tStatus)} />
                </span>
              </>
            );

            return (
              <li key={order.id}>
                {href === null ? (
                  <span className="flex items-center gap-3 py-3">{row}</span>
                ) : (
                  <Link
                    className="flex cursor-pointer items-center gap-3 rounded-md py-3 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 hover:[&_.text-ink]:text-primary"
                    href={href}
                  >
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </StatisticsSection>
  );
}
