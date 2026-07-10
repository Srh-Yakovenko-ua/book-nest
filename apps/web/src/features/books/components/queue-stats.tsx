"use client";

import { useTranslations } from "next-intl";

import { StatCard } from "@/components/ui/stat-card";

type QueueStatsProps = {
  count: number;
  totalPagesCount: number;
};

export function QueueStats({ count, totalPagesCount }: QueueStatsProps) {
  const t = useTranslations("readingQueue.stats");

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
      <StatCard
        icon="list"
        label={t("booksInQueue")}
        size="compact"
        value={count.toLocaleString()}
      />
      <StatCard
        icon="pages"
        label={t("totalLength")}
        size="compact"
        value={t("pages", { count: totalPagesCount })}
      />
    </div>
  );
}
