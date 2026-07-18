"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";

type ReadingProgressForecastProps = {
  estimatedActiveDaysRemaining: number;
};

export function ReadingProgressForecast({
  estimatedActiveDaysRemaining,
}: ReadingProgressForecastProps) {
  const t = useTranslations("books.details.reading");

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5">
      <UiIcon aria-hidden className="mt-0.5 shrink-0 text-primary" name="trend-up" size={16} />
      <p className="text-sm text-foreground/90">
        {t("estimatedDaysRemaining", { count: estimatedActiveDaysRemaining })}
      </p>
    </div>
  );
}
