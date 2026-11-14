"use client";

import type { InTransitSummaryView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { SummaryError } from "@/components/summary-error";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { useDeliveryInTransitSummary } from "../api/use-delivery-summary";

const DELIVERY_WIDGET = {
  card: "flex flex-col gap-4 border border-border bg-card p-5 shadow-card max-sm:p-4",
  header: "flex items-center justify-between gap-3 max-sm:flex-wrap max-sm:gap-y-2",
  heading: "flex min-w-0 items-center gap-2.5",
  skeletonStatCount: 3,
  stat: "flex min-w-0 flex-col gap-1 rounded-md border border-border/60 bg-secondary/40 p-3 max-sm:p-2.5",
  stats: "grid grid-cols-3 gap-3 max-sm:gap-2",
} as const;

export function DeliveryDashboardWidget() {
  const t = useTranslations("home.delivery");
  const summary = useDeliveryInTransitSummary();
  const hasNoActiveDeliveries = summary.data?.activeBooksCount === 0;

  return (
    <SummaryError
      className={hasNoActiveDeliveries ? "sr-only" : undefined}
      state={summary.isLoadingError ? { onRetry: () => void summary.refetch() } : null}
      title={t("error.title")}
    >
      {summary.data === undefined ? (
        <DeliveryWidgetSkeleton />
      ) : hasNoActiveDeliveries ? null : (
        <DeliveryWidgetCard summary={summary.data} />
      )}
    </SummaryError>
  );
}

function DeliveryWidgetCard({ summary }: { summary: InTransitSummaryView }) {
  const t = useTranslations("home.delivery");
  const locale = useLocale();

  return (
    <Card className={DELIVERY_WIDGET.card}>
      <div className={DELIVERY_WIDGET.header}>
        <div className={DELIVERY_WIDGET.heading}>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary">
            <UiIcon name="truck" size={18} />
          </span>
          <h2 className="font-heading text-base font-semibold text-balance text-ink max-sm:text-sm">
            {t("title")}
          </h2>
        </div>
        <Link
          className="inline-flex shrink-0 items-center gap-1 rounded-sm text-sm font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          href="/delivery/in-transit"
        >
          {t("viewAll")}
          <UiIcon className="shrink-0" name="arrow-right" size={15} />
        </Link>
      </div>

      <dl className={DELIVERY_WIDGET.stats}>
        <WidgetStat label={t("active")} locale={locale} value={summary.activeBooksCount} />
        <WidgetStat
          label={t("expectedThisWeek")}
          locale={locale}
          value={summary.expectedThisWeekCount}
        />
        <WidgetStat
          emphasis={summary.delayedCount > 0}
          label={t("delayed")}
          locale={locale}
          value={summary.delayedCount}
        />
      </dl>
    </Card>
  );
}

function DeliveryWidgetSkeleton() {
  const t = useTranslations("home.delivery");

  return (
    <Card aria-busy="true" aria-label={t("loading")} className={DELIVERY_WIDGET.card} role="status">
      <div className={DELIVERY_WIDGET.header}>
        <div className={DELIVERY_WIDGET.heading}>
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <Skeleton className="h-5 w-36" />
        </div>
        <Skeleton className="h-4 w-28" />
      </div>

      <div className={DELIVERY_WIDGET.stats}>
        {Array.from({ length: DELIVERY_WIDGET.skeletonStatCount }, (_, index) => (
          <div className={DELIVERY_WIDGET.stat} key={index}>
            <Skeleton className="h-8 w-10" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
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
    <div className={DELIVERY_WIDGET.stat}>
      <span
        className={cn(
          "font-heading text-2xl font-semibold tabular-nums",
          emphasis ? "text-destructive" : "text-ink",
        )}
      >
        {value.toLocaleString(locale)}
      </span>
      <span className="text-xs leading-tight text-muted-foreground max-sm:text-[0.6875rem]">
        {label}
      </span>
    </div>
  );
}
