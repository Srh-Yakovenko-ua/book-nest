"use client";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { useDeliveryInTransitSummary } from "../api/use-delivery-summary";

export function DeliveryDashboardWidget() {
  const t = useTranslations("home.delivery");
  const locale = useLocale();
  const { data } = useDeliveryInTransitSummary();

  if (data === undefined || data.activeCount === 0) return null;

  return (
    <Card className="flex flex-col gap-4 border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary">
            <UiIcon name="truck" size={18} />
          </span>
          <h2 className="truncate font-heading text-base font-semibold text-ink">{t("title")}</h2>
        </div>
        <Link
          className="inline-flex shrink-0 items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          href="/delivery/in-transit"
        >
          {t("viewAll")}
          <UiIcon className="shrink-0" name="arrow-right" size={15} />
        </Link>
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <WidgetStat label={t("active")} locale={locale} value={data.activeCount} />
        <WidgetStat label={t("expectedThisWeek")} locale={locale} value={data.expectedThisWeek} />
        <WidgetStat
          emphasis={data.delayedCount > 0}
          label={t("delayed")}
          locale={locale}
          value={data.delayedCount}
        />
      </dl>
    </Card>
  );
}

function WidgetStat({
  emphasis = false,
  label,
  locale,
  value,
}: {
  emphasis?: boolean;
  label: string;
  locale: string;
  value: number;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-secondary/40 p-3">
      <span
        className={cn(
          "font-heading text-2xl font-semibold tabular-nums",
          emphasis ? "text-destructive" : "text-ink",
        )}
      >
        {value.toLocaleString(locale)}
      </span>
      <span className="text-xs leading-tight text-muted-foreground">{label}</span>
    </div>
  );
}
