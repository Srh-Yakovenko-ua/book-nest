"use client";

import type { SeriesStatsView } from "@app/shared";

import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SeriesStatsCardProps = {
  stats: SeriesStatsView;
};

export function SeriesStatsCard({ stats }: SeriesStatsCardProps) {
  const t = useTranslations("series.details.stats");

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <h2>{t("title")}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="flex flex-col gap-3">
          <StatRow label={t("total")} value={String(stats.booksCount)} />
          <StatRow label={t("finished")} value={String(stats.finishedCount)} />
          <StatRow label={t("reading")} value={String(stats.readingCount)} />
          <StatRow label={t("unread")} value={String(stats.unreadCount)} />
          {stats.averageRating === null ? null : (
            <StatRow label={t("averageRating")} value={`${stats.averageRating.toFixed(1)}/10`} />
          )}
          {stats.pagesCount === null ? null : (
            <StatRow label={t("pages")} value={stats.pagesCount.toLocaleString()} />
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground/90 tabular-nums">{value}</dd>
    </div>
  );
}
