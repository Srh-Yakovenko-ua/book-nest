"use client";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

import { SERIES_ORDER_SIDEBAR_LIMIT } from "../model/series-order-check";

export function SeriesOrderCheckSkeleton() {
  const t = useTranslations("readingQueue.seriesOrderCheck");

  return (
    <div aria-busy aria-label={t("loading")} className="flex flex-col gap-3" role="status">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-5 w-44 rounded-md" />
        <Skeleton className="h-4 w-full rounded-md" />
      </div>
      {Array.from({ length: SERIES_ORDER_SIDEBAR_LIMIT }, (_, index) => (
        <Skeleton className="h-64 w-full rounded-xl" key={index} />
      ))}
    </div>
  );
}
