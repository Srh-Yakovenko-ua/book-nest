"use client";

import type { BookOrderStatisticsView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDate } from "@/lib/format";

import { formatCurrencyTotals, formatMoney } from "../model/money-format";
import {
  buildStatusBreakdown,
  buildStoreRows,
  buildTopOrders,
} from "../model/statistics-view-model";

export function DeliveryStatusBreakdown({ view }: { view: BookOrderStatisticsView }) {
  const t = useTranslations("delivery.statistics.status");
  const locale = useLocale();
  const entries = buildStatusBreakdown(view, (key) => t(key));

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-base font-semibold text-ink">{t("title")}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {entries.map((entry) => (
          <div
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-card"
            key={entry.key}
          >
            <StatusBadge entry={entry.badge} />
            <span className="font-heading text-2xl font-bold text-ink tabular-nums">
              {entry.count.toLocaleString(locale)}
            </span>
            <span className="text-sm text-muted-foreground">
              {formatCurrencyTotals(entry.totalsByCurrency, locale)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function DeliveryStoreBreakdown({ view }: { view: BookOrderStatisticsView }) {
  const t = useTranslations("delivery.statistics.stores");
  const locale = useLocale();
  const rows = buildStoreRows(view);

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
      <h2 className="font-heading text-base font-semibold text-ink">{t("title")}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li className="flex flex-col gap-1.5" key={row.store}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {row.store}
                </span>
                <span className="shrink-0 text-sm font-semibold text-ink tabular-nums">
                  {formatCurrencyTotals(row.totalsByCurrency, locale)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${Math.max(row.share * 100, 4)}%` }}
                  />
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {t("orders", { count: row.ordersCount })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function DeliveryTopOrders({ view }: { view: BookOrderStatisticsView }) {
  const t = useTranslations("delivery.statistics.topOrders");
  const tStatus = useTranslations("delivery.statistics.orderStatus");
  const locale = useLocale();
  const rows = buildTopOrders(view, (status) => tStatus(status));

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
      <h2 className="font-heading text-base font-semibold text-ink">{t("title")}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-border">
          {rows.map((row, index) => (
            <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0" key={row.id}>
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground tabular-nums">
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-ink">
                  {row.orderNumber ?? t("untitledOrder")}
                </span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <UiIcon name="store" size={12} />
                    {row.storeName}
                  </span>
                  {row.orderDate === null ? null : (
                    <span className="inline-flex items-center gap-1">
                      <UiIcon name="calendar" size={12} />
                      {formatDate(row.orderDate, locale)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <UiIcon name="book" size={12} />
                    {t("books", { count: row.booksCount })}
                  </span>
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {formatMoney({ amount: row.priceAmount, currency: row.priceCurrency, locale })}
                </span>
                <StatusBadge entry={row.badge} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
