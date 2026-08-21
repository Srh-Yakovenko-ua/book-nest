"use client";

import type { BookOrderStatisticsPulse, BookOrderStatisticsPulseTone, Nullable } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";

import { formatMoney } from "../../model/money-format";
import { monthLabel } from "../../model/statistics-dynamics";
import { formatPercentValue } from "../../model/statistics-format";
import { pulseItems } from "../../model/statistics-pulse";
import { StatisticsSection } from "./statistics-section";

const TONE_STYLE: Record<BookOrderStatisticsPulseTone, { className: string; icon: UiIconName }> = {
  attention: { className: "bg-favorite-soft text-favorite", icon: "alert-circle" },
  neutral: { className: "bg-accent text-icon", icon: "info" },
  positive: { className: "bg-success-soft text-success", icon: "sparkles" },
};

export function StatisticsPulse({
  comparisonLabel,
  pulse,
}: {
  comparisonLabel: Nullable<string>;
  pulse: BookOrderStatisticsPulse;
}) {
  const t = useTranslations("delivery.statistics.pulse");
  const locale = useLocale();

  const items = pulseItems(pulse, {
    comparison: comparisonLabel ?? t("previousPeriod"),
    money: (amount, currency) => formatMoney({ amount, currency, locale }),
    month: (monthKey) => monthLabel(monthKey, locale, true),
    percent: (value) => formatPercentValue(value, locale),
  });

  return (
    <StatisticsSection className="h-full" description={t("subtitle")} title={t("title")}>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const tone = TONE_STYLE[item.tone];
            return (
              <li className="flex items-start gap-2.5" key={item.id}>
                <span
                  className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${tone.className}`}
                >
                  <UiIcon name={tone.icon} size={15} />
                </span>
                <p className="text-sm leading-snug text-foreground">
                  {t(item.messageKey, item.values)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </StatisticsSection>
  );
}
