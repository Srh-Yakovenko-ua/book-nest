"use client";

import type { GenreSummaryGenreView, GenreSummaryView } from "@app/shared";

import { GENRE_SUMMARY_RULES } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { topGenreIconSlot } from "@/features/books/components/top-genre-icon-slot";
import { formatNumber } from "@/lib/format";

import type { GenreLeaderCardKey, GenreLeaderFact } from "./genre-summary";

import { genreLeaderFact, usedGenresFact } from "./genre-summary";

type LeaderCardSpec = {
  copy: LeaderCopy;
  icon: LibrarySummaryCard["icon"];
  iconTone: LibrarySummaryCard["iconTone"];
  key: GenreLeaderCardKey;
};

type LeaderCopy = {
  single: (leader: GenreSummaryGenreView) => string;
  tie: (leader: GenreSummaryGenreView) => string;
  tieMore: (leader: GenreSummaryGenreView, extra: number) => string;
};

const GENRE_SUMMARY_CARDS = {
  emptyValue: "—",
  leadersSeparator: ", ",
  ratingFormat: { maximumFractionDigits: 1, minimumFractionDigits: 1 },
  singleValueClassName: "line-clamp-2 text-xl leading-snug",
  tieValueClassName: "line-clamp-2 text-lg leading-snug",
} as const;

export function useGenreSummaryCards(summary: GenreSummaryView | undefined): LibrarySummaryCard[] {
  const t = useTranslations("genres.summary");
  const locale = useLocale();

  if (summary === undefined) return [];

  const used = usedGenresFact(summary);
  const rating = (leader: GenreSummaryGenreView) =>
    leader.averageRating === null
      ? GENRE_SUMMARY_CARDS.emptyValue
      : formatNumber(leader.averageRating, locale, GENRE_SUMMARY_CARDS.ratingFormat);

  function leaderMicrofact(fact: GenreLeaderFact, copy: LeaderCopy): string {
    if (fact.kind === "missing") {
      return t(`facts.${fact.reason}`, { min: GENRE_SUMMARY_RULES.highestRatedMinRatedBooks });
    }
    const [first] = fact.leaders;
    if (first === undefined) return GENRE_SUMMARY_CARDS.emptyValue;
    if (fact.hiddenLeadersCount > 0) return copy.tieMore(first, fact.hiddenLeadersCount);
    return fact.leaders.length > 1 ? copy.tie(first) : copy.single(first);
  }

  const leaderCard = ({ copy, icon, iconTone, key }: LeaderCardSpec): LibrarySummaryCard => {
    const fact = genreLeaderFact(summary, key);
    return {
      icon,
      iconTone,
      label: t(`cards.${key}`),
      microfact: <span className="line-clamp-2 break-words">{leaderMicrofact(fact, copy)}</span>,
      value: leaderValue(fact),
      valueClassName: leaderValueClassName(fact),
    };
  };

  const mostFrequent = genreLeaderFact(summary, "mostFrequent");

  return [
    {
      icon: "hash",
      iconTone: "genre",
      label: t("cards.usedGenres"),
      microfact:
        used.kind === "inBooks"
          ? t("facts.inBooks", { count: used.booksCount })
          : t(`facts.${used.reason}`),
      value: formatNumber(summary.usedGenresCount, locale),
    },
    {
      ...leaderCard({
        copy: {
          single: (leader) => t("facts.booksSingle", { count: leader.booksCount }),
          tie: (leader) => t("facts.booksTie", { count: leader.booksCount }),
          tieMore: (leader, extra) => t("facts.booksTieMore", { count: leader.booksCount, extra }),
        },
        icon: "hash",
        iconTone: "genre",
        key: "mostFrequent",
      }),
      iconSlot:
        mostFrequent.kind === "leaders"
          ? topGenreIconSlot(mostFrequent.leaders.map((leader) => leader.key))
          : undefined,
    },
    leaderCard({
      copy: {
        single: (leader) =>
          t("facts.ratingSingle", { count: leader.ratedBooksCount, rating: rating(leader) }),
        tie: (leader) =>
          t("facts.ratingTie", { count: leader.ratedBooksCount, rating: rating(leader) }),
        tieMore: (leader, extra) =>
          t("facts.ratingTieMore", {
            count: leader.ratedBooksCount,
            extra,
            rating: rating(leader),
          }),
      },
      icon: "star",
      iconTone: "favorite",
      key: "highestRated",
    }),
    leaderCard({
      copy: {
        single: (leader) =>
          t("facts.readSingle", { count: leader.readCount, total: leader.booksCount }),
        tie: (leader) => t("facts.readTie", { count: leader.readCount }),
        tieMore: (leader, extra) => t("facts.readTieMore", { count: leader.readCount, extra }),
      },
      icon: "check-circle",
      iconTone: "success",
      key: "mostRead",
    }),
    leaderCard({
      copy: {
        single: (leader) =>
          t("facts.queueSingle", { count: leader.readingQueueCount, total: leader.booksCount }),
        tie: (leader) => t("facts.queueTie", { count: leader.readingQueueCount }),
        tieMore: (leader, extra) =>
          t("facts.queueTieMore", { count: leader.readingQueueCount, extra }),
      },
      icon: "list",
      iconTone: "primary",
      key: "mostQueued",
    }),
    leaderCard({
      copy: {
        single: (leader) =>
          t("facts.wishSingle", { count: leader.wantToBuyCount, total: leader.booksCount }),
        tie: (leader) => t("facts.wishTie", { count: leader.wantToBuyCount }),
        tieMore: (leader, extra) => t("facts.wishTieMore", { count: leader.wantToBuyCount, extra }),
      },
      icon: "cart",
      iconTone: "primary",
      key: "mostWantedToBuy",
    }),
  ];
}

function leaderValue(fact: GenreLeaderFact): string {
  if (fact.kind === "missing") return GENRE_SUMMARY_CARDS.emptyValue;
  return fact.leaders.map((leader) => leader.label).join(GENRE_SUMMARY_CARDS.leadersSeparator);
}

function leaderValueClassName(fact: GenreLeaderFact): string | undefined {
  if (fact.kind === "missing") return undefined;
  return fact.leaders.length > 1
    ? GENRE_SUMMARY_CARDS.tieValueClassName
    : GENRE_SUMMARY_CARDS.singleValueClassName;
}
