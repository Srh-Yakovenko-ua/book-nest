"use client";

import type { LibraryPublisherDetailStats } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { StatCard } from "@/components/ui/stat-card";
import { formatDate, formatNumber } from "@/lib/format";

type PublisherStatsGridProps = {
  stats: LibraryPublisherDetailStats;
};

export function PublisherStatsGrid({ stats }: PublisherStatsGridProps) {
  const t = useTranslations("publishers.details.kpi");
  const locale = useLocale();

  const lastAddedCaption =
    stats.booksCount === 0 || stats.lastBookAddedAt === null
      ? undefined
      : t("lastAdded", { date: formatDate(stats.lastBookAddedAt, locale) });

  const readCaption =
    stats.booksCount === 0
      ? undefined
      : t("readPercent", { percent: Math.round((stats.readCount / stats.booksCount) * 100) });

  const withoutPriceCaption =
    stats.wishlistWithoutPriceCount > 0
      ? t("withoutPrice", { count: stats.wishlistWithoutPriceCount })
      : undefined;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        caption={lastAddedCaption}
        icon="library"
        iconTone="primary"
        label={t("books")}
        labelOverflow="wrap"
        size="compact"
        value={formatNumber(stats.booksCount, locale)}
      />
      <StatCard
        caption={readCaption}
        icon="check-circle"
        iconTone="success"
        label={t("read")}
        labelOverflow="wrap"
        size="compact"
        value={formatNumber(stats.readCount, locale)}
      />
      <StatCard
        caption={withoutPriceCaption}
        icon="cart"
        iconTone="tag"
        label={t("wishlist")}
        labelOverflow="wrap"
        size="compact"
        value={formatNumber(stats.wantToBuyCount, locale)}
      />
      <StatCard
        caption={stats.averageRating === null ? t("noRatedBooks") : t("ratedCaption")}
        icon="star-fill"
        iconTone="favorite"
        label={t("rating")}
        labelOverflow="wrap"
        size="compact"
        value={
          stats.averageRating === null
            ? t("noRating")
            : formatNumber(stats.averageRating, locale, {
                maximumFractionDigits: 1,
                minimumFractionDigits: 1,
              })
        }
      />
    </div>
  );
}
