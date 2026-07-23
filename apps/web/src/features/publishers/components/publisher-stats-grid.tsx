"use client";

import type { LibraryPublisherStats } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";
import type { StatCardIconTone } from "@/components/ui/stat-card";

import { StatCard } from "@/components/ui/stat-card";
import { formatDate, formatNumber } from "@/lib/format";

type CountCard = {
  icon: UiIconName;
  key: "books" | "queue" | "read" | "reading" | "toBuy" | "wantToRead";
  tone: StatCardIconTone;
  value: number;
};

type PublisherStatsGridProps = {
  stats: LibraryPublisherStats;
};

export function PublisherStatsGrid({ stats }: PublisherStatsGridProps) {
  const t = useTranslations("publishers.details.kpi");
  const locale = useLocale();

  const countCards: CountCard[] = [
    { icon: "library", key: "books", tone: "primary", value: stats.booksCount },
    { icon: "check-circle", key: "read", tone: "success", value: stats.readCount },
    { icon: "book", key: "reading", tone: "info", value: stats.readingCount },
    { icon: "bookmark", key: "wantToRead", tone: "ink", value: stats.wantToReadCount },
    { icon: "cart", key: "toBuy", tone: "tag", value: stats.wantToBuyCount },
    { icon: "list", key: "queue", tone: "genre", value: stats.queueCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {countCards.map((card) => (
        <StatCard
          icon={card.icon}
          iconTone={card.tone}
          key={card.key}
          label={t(card.key)}
          size="compact"
          value={formatNumber(card.value, locale)}
        />
      ))}

      <StatCard
        caption={
          stats.averageRating === null
            ? undefined
            : t("ratedCount", { count: stats.ratedBooksCount })
        }
        icon="star-fill"
        iconTone="favorite"
        label={t("rating")}
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

      <StatCard
        icon="calendar"
        iconTone="ink"
        label={t("lastAdded")}
        size="compact"
        value={
          stats.lastBookAddedAt === null
            ? t("lastAddedNever")
            : formatDate(stats.lastBookAddedAt, locale)
        }
        valueClassName="text-lg"
      />
    </div>
  );
}
