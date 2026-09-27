"use client";

import { useLocale, useTranslations } from "next-intl";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { formatNumber } from "@/lib/format";

import type { NotesArchiveSummary } from "../api/use-notes-summary";
import type { NotesArchiveScope } from "./notes-archive-config";

const EMPTY_NOTES_SUMMARY: NotesArchiveSummary = {
  createdLast30DaysCount: 0,
  denseEntitiesCount: 0,
  entitiesWithNotesCount: 0,
  notesCount: 0,
  topAuthor: null,
  topEntity: null,
};

export function useNotesSummaryCards(
  scope: NotesArchiveScope,
  summary: NotesArchiveSummary | undefined,
): LibrarySummaryCard[] {
  const t = useTranslations(`notes.archive.${scope}.summary`);
  const tFacts = useTranslations("notes.archive.summaryFacts");
  const locale = useLocale();

  const stats = summary ?? EMPTY_NOTES_SUMMARY;
  const { topAuthor, topEntity } = stats;

  const topAuthorMicrofact = () => {
    if (topAuthor === null) return tFacts("noAuthorData");
    if (topAuthor.name !== null) return topAuthor.name;
    return tFacts("topAuthorLeaders", { count: topAuthor.leadersCount });
  };

  const topEntityMicrofact = () => {
    if (topEntity === null) return tFacts("noNotesYet");
    if (topEntity.name !== null) return topEntity.name;
    if (topEntity.notesCount === 1 && topEntity.leadersCount === stats.entitiesWithNotesCount) {
      return t("allEntitiesSingleNote");
    }
    return t("topEntityLeaders", { count: topEntity.leadersCount });
  };

  const labels = (key: "entities" | "notes" | "topAuthor" | "topEntity") => ({
    label: t(key),
    mobileLabels: { compact: t(`compact.${key}`), detailed: t(key) },
  });

  return [
    {
      ...labels("notes"),
      icon: "note",
      iconTone: "primary",
      microfact:
        stats.createdLast30DaysCount === 0
          ? tFacts("createdRecentlyNone")
          : tFacts("createdRecently", { count: stats.createdLast30DaysCount }),
      value: formatNumber(stats.notesCount, locale),
    },
    {
      ...labels("entities"),
      icon: scope === "books" ? "library-big" : "layers",
      iconTone: "info",
      microfact:
        stats.denseEntitiesCount === 0
          ? t("denseNone")
          : t("dense", { count: stats.denseEntitiesCount }),
      value: formatNumber(stats.entitiesWithNotesCount, locale),
    },
    {
      ...labels("topAuthor"),
      icon: "user-round",
      iconTone: "genre",
      microfact: topAuthorMicrofact(),
      value: topAuthor === null ? tFacts("empty") : formatNumber(topAuthor.notesCount, locale),
    },
    {
      ...labels("topEntity"),
      icon: "book-open-text",
      iconTone: "ink",
      microfact: topEntityMicrofact(),
      value: topEntity === null ? tFacts("empty") : formatNumber(topEntity.notesCount, locale),
    },
  ];
}
