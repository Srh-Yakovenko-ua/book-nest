"use client";

import type { BookOrderStatisticsView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { BarChart } from "@/components/ui/charts/bar-chart";

import { formatMoney } from "../model/money-format";
import {
  buildMonthlyOrdersSeries,
  buildMonthlySpendingSeries,
} from "../model/statistics-view-model";

export function DeliveryMonthlyChart({ view }: { view: BookOrderStatisticsView }) {
  const t = useTranslations("delivery.statistics.monthly");
  const locale = useLocale();

  const spending = buildMonthlySpendingSeries(view, locale);
  const orders = buildMonthlyOrdersSeries(view, locale);

  if (view.monthly.length === 0) {
    return (
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
        <h2 className="font-heading text-base font-semibold text-ink">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-base font-semibold text-ink">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-6">
        {spending.map((series) => (
          <div className="flex flex-col gap-2" key={series.currency}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-foreground">
                {t("spendingIn", { currency: series.currency })}
              </span>
              <span className="text-sm font-semibold text-ink tabular-nums">
                {formatMoney({ amount: series.total, currency: series.currency, locale })}
              </span>
            </div>
            <BarChart
              ariaLabel={t("spendingAria", { currency: series.currency })}
              data={series.data}
              valueLabel={t("spendingIn", { currency: series.currency })}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <span className="text-sm font-medium text-foreground">{t("ordersTitle")}</span>
        <BarChart ariaLabel={t("ordersAria")} data={orders} valueLabel={t("ordersValueLabel")} />
      </div>
    </section>
  );
}
