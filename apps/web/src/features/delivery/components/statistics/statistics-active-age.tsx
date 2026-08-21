"use client";

import type { ActiveMoneyAgeResponse } from "@app/shared";

import { ACTIVE_MONEY_AGE_BUCKET_DAYS } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";

import type { StatisticsDrilldownFilters } from "../../model/statistics-drilldown";

import { formatCurrencyTotals } from "../../model/money-format";
import { activeAgeHref } from "../../model/statistics-drilldown";
import { StatisticsSection } from "./statistics-section";

const BUCKET_ORDER = [
  "0_7",
  "8_14",
  "15_30",
  "31_plus",
  "unknown_date",
] as const satisfies readonly ("unknown_date" | keyof typeof ACTIVE_MONEY_AGE_BUCKET_DAYS)[];

export function StatisticsActiveAge({
  data,
  drilldown,
  isLoading,
}: {
  data: ActiveMoneyAgeResponse | undefined;
  drilldown: StatisticsDrilldownFilters;
  isLoading: boolean;
}) {
  const t = useTranslations("delivery.statistics.activeAge");
  const locale = useLocale();

  const buckets = (data?.buckets ?? [])
    .filter((bucket) => bucket.ordersCount > 0)
    .sort((left, right) => BUCKET_ORDER.indexOf(left.key) - BUCKET_ORDER.indexOf(right.key));

  return (
    <StatisticsSection
      className="h-full"
      description={t("subtitle")}
      snapshotLabel={t("snapshotBadge")}
      title={t("title")}
    >
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-12 w-full rounded-lg" key={index} />
          ))}
        </div>
      ) : buckets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {buckets.map((bucket) => (
            <li key={bucket.key}>
              <Link
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 transition-colors outline-none hover:border-accent-border hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                href={activeAgeHref(bucket.key, drilldown)}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {t(`buckets.${bucket.key}`)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("counts", {
                      books: bucket.booksCount,
                      orders: bucket.ordersCount,
                    })}
                  </span>
                </span>
                <span className="shrink-0 text-end text-sm font-semibold text-ink tabular-nums">
                  {formatCurrencyTotals(bucket.totalsByCurrency, locale)}
                </span>
                <UiIcon className="shrink-0 text-icon" name="chevron-right" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {data === undefined ? null : (
        <p className="text-xs text-muted-foreground">
          {t("asOf", { value: formatDate(data.asOf, locale) })}
        </p>
      )}
    </StatisticsSection>
  );
}
