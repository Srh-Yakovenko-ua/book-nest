"use client";

import type { Nullable, ReadingStatisticsDiscoveriesSection } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

import { formatDayShort, formatRatingScore } from "../../model/statistics-format";
import { useGenreName } from "../../model/use-genre-name";
import { StatisticsSection } from "../statistics-section";
import { StatisticsStat } from "../statistics-stat";
import { StatisticsNote, StatisticsSectionState } from "../statistics-states";

const DISCOVERY_ICON = {
  author: "user",
  genre: "tag",
  publisher: "building",
} as const satisfies Record<DiscoveryCard["kind"], UiIconName>;

type DiscoveryCard = {
  averageRating: Nullable<number>;
  completedReadsAfterDiscovery: number;
  firstFinishedAt: string;
  kind: "author" | "genre" | "publisher";
  name: string;
};

export function DiscoveriesSection({
  discoveries,
}: {
  discoveries: ReadingStatisticsDiscoveriesSection;
}) {
  const locale = useLocale();
  const t = useTranslations("statistics.discoveries");
  const genreName = useGenreName();
  const cards = toCards({ discoveries, genreName });

  if (discoveries.availability === "unavailable") {
    return (
      <StatisticsSection description={t("description")} title={t("title")}>
        <StatisticsSectionState
          description={t(`reason.${discoveries.reason ?? "LEGACY_HISTORY_INCOMPLETE"}`)}
          kind="unavailable"
          title={t("unavailable")}
        />
      </StatisticsSection>
    );
  }

  return (
    <StatisticsSection
      description={t("description")}
      note={
        discoveries.availability === "partial" ? (
          <StatisticsNote>{t("partialNote")}</StatisticsNote>
        ) : null
      }
      title={t("title")}
    >
      <dl className="grid grid-cols-3 gap-2">
        <StatisticsStat
          label={t("countLabels.authors")}
          value={formatNumber(discoveries.newAuthorsCount, locale)}
        />
        <StatisticsStat
          label={t("countLabels.genres")}
          value={formatNumber(discoveries.newGenresCount, locale)}
        />
        <StatisticsStat
          label={t("countLabels.publishers")}
          value={formatNumber(discoveries.newPublishersCount, locale)}
        />
      </dl>

      {cards.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <div
          aria-label={t("title")}
          className="-mx-1 snap-x snap-mandatory overflow-x-auto rounded-lg px-1 pb-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:overflow-visible"
          role="region"
          tabIndex={0}
        >
          <ul className="flex gap-3 lg:grid lg:grid-cols-3">
            {cards.map((card) => (
              <li className="w-[85%] shrink-0 snap-start lg:w-auto lg:shrink" key={card.kind}>
                <DiscoveryCardView card={card} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </StatisticsSection>
  );
}

function DiscoveryCardView({ card }: { card: DiscoveryCard }): ReactNode {
  const locale = useLocale();
  const t = useTranslations("statistics.discoveries");

  return (
    <Card className="flex h-full flex-col gap-1 px-4 py-3.5">
      <span className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        <UiIcon aria-hidden className="text-primary" name={DISCOVERY_ICON[card.kind]} size={14} />
        {t(`kinds.${card.kind}`)}
      </span>
      <span className="line-clamp-2 font-heading text-base font-semibold text-ink">
        {card.name}
      </span>
      <span className="text-xs text-muted-foreground">
        {t("firstRead", { date: formatDayShort(card.firstFinishedAt, locale) })}
      </span>
      <span className="text-xs text-muted-foreground tabular-nums">
        {t("afterDiscovery", { count: card.completedReadsAfterDiscovery })}
        {card.averageRating === null
          ? null
          : ` · ${t("averageRating", { value: formatRatingScore(card.averageRating, locale) })}`}
      </span>
    </Card>
  );
}

function toCards({
  discoveries,
  genreName,
}: {
  discoveries: ReadingStatisticsDiscoveriesSection;
  genreName: (genreKey: string) => string;
}): DiscoveryCard[] {
  const cards: DiscoveryCard[] = [];

  if (discoveries.author !== null) {
    cards.push({ ...discoveries.author, kind: "author" });
  }
  if (discoveries.genre !== null) {
    cards.push({
      ...discoveries.genre,
      kind: "genre",
      name: genreName(discoveries.genre.genreKey),
    });
  }
  if (discoveries.publisher !== null) {
    cards.push({ ...discoveries.publisher, kind: "publisher" });
  }

  return cards;
}
