"use client";

import type { TagsSummaryView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { formatNumber } from "@/lib/format";

import { formatTagShare, mostUsedTagFact, shareOf } from "./tags-summary";

const TAGS_SUMMARY_CARDS = {
  emptyValue: "—",
  leaderValueClassName: "line-clamp-2 text-xl leading-snug",
} as const;

export function useTagsSummaryCards(summary: TagsSummaryView | undefined): LibrarySummaryCard[] {
  const t = useTranslations("tags.summary");
  const locale = useLocale();

  if (summary === undefined) return [];

  const percent = (part: number, whole: number) => formatTagShare(shareOf(part, whole), locale);
  const mostUsed = mostUsedTagFact(summary);
  const unused = summary.usageDistribution.unused;

  return [
    {
      icon: "tag",
      iconTone: "tag",
      label: t("cards.totalTags"),
      microfact: unused === 0 ? t("facts.allUsed") : t("facts.unused", { count: unused }),
      value: formatNumber(summary.totalTagsCount, locale),
    },
    {
      icon: "book",
      iconTone: "info",
      label: t("cards.taggedBooks"),
      microfact: t("facts.booksShare", {
        percent: percent(summary.taggedBooksCount, summary.totalBooksCount),
      }),
      value: formatNumber(summary.taggedBooksCount, locale),
    },
    {
      icon: "user",
      iconTone: "genre",
      label: t("cards.taggedCharacters"),
      microfact: t("facts.charactersShare", {
        percent: percent(summary.taggedCharactersCount, summary.totalCharactersCount),
      }),
      value: formatNumber(summary.taggedCharactersCount, locale),
    },
    mostUsed.kind === "none"
      ? {
          icon: "trophy",
          iconTone: "favorite",
          label: t("cards.mostUsed"),
          microfact: t("facts.noLeader"),
          value: TAGS_SUMMARY_CARDS.emptyValue,
        }
      : {
          icon: "trophy",
          iconTone: "favorite",
          label: t("cards.mostUsed"),
          microfact: (
            <span className="flex flex-col gap-0.5">
              <span>
                {t("facts.leaderBreakdown", {
                  books: mostUsed.leader.booksCount,
                  characters: mostUsed.leader.charactersCount,
                })}
              </span>
              {mostUsed.hiddenLeadersCount > 0 ? (
                <span className="font-medium text-ink">
                  {t("facts.tieMore", { count: mostUsed.hiddenLeadersCount })}
                </span>
              ) : null}
            </span>
          ),
          value: mostUsed.leader.name,
          valueClassName: TAGS_SUMMARY_CARDS.leaderValueClassName,
        },
  ];
}
