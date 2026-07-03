"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

type SeriesOverviewErrorProps = {
  onRetry: () => void;
};

export function SeriesOverviewError({ onRetry }: SeriesOverviewErrorProps) {
  const t = useTranslations("series.states.error");

  return (
    <div
      className="flex flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
      role="alert"
    >
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-ink">{t("title")}</p>
        <p className="text-xs text-muted-foreground">{t("description")}</p>
      </div>
      <Button onClick={onRetry} size="sm" variant="secondary">
        <UiIcon name="refresh" size={16} />
        {t("retry")}
      </Button>
    </div>
  );
}
