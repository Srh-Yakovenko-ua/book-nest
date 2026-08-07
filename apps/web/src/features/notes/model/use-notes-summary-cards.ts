"use client";

import type { NotesSummaryView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";
import type { StatCardIconTone } from "@/components/ui/stat-card";
import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { formatNumber } from "@/lib/format";

type NotesSummaryCountField = {
  [Key in keyof NotesSummaryView]: NotesSummaryView[Key] extends number ? Key : never;
}[keyof NotesSummaryView];

type NotesSummaryStat = {
  compactKey?: string;
  field: NotesSummaryCountField;
  icon: UiIconName;
  labelKey: string;
  tone: StatCardIconTone;
};

const NOTES_SUMMARY_STATS = [
  {
    compactKey: "total",
    field: "total",
    icon: "note",
    labelKey: "total",
    tone: "primary",
  },
  {
    compactKey: "bookNotes",
    field: "bookNotesCount",
    icon: "book",
    labelKey: "bookNotes",
    tone: "info",
  },
  {
    compactKey: "seriesNotes",
    field: "seriesNotesCount",
    icon: "layers",
    labelKey: "seriesNotes",
    tone: "genre",
  },
  { field: "withoutSpoilerCount", icon: "eye", labelKey: "withoutSpoiler", tone: "success" },
  { field: "withSpoilerCount", icon: "eye-off", labelKey: "withSpoiler", tone: "ink" },
  { field: "favoriteCount", icon: "heart-fill", labelKey: "favorite", tone: "favorite" },
  { field: "pinnedCount", icon: "bookmark", labelKey: "pinned", tone: "tag" },
  { field: "booksWithNotesCount", icon: "library", labelKey: "booksWithNotes", tone: "info" },
  { field: "seriesWithNotesCount", icon: "list", labelKey: "seriesWithNotes", tone: "genre" },
] as const satisfies readonly NotesSummaryStat[];

export function useNotesSummaryCards(summary: NotesSummaryView | undefined): LibrarySummaryCard[] {
  const locale = useLocale();
  const t = useTranslations("notes.archive.sidebar.stats");
  const tCompact = useTranslations("notes.archive.summary.mobile.compact");

  return NOTES_SUMMARY_STATS.map((stat) => {
    const label = t(stat.labelKey);

    return {
      icon: stat.icon,
      iconTone: stat.tone,
      label,
      mobileLabels:
        "compactKey" in stat ? { compact: tCompact(stat.compactKey), detailed: label } : undefined,
      value: formatNumber(summary?.[stat.field] ?? 0, locale),
    };
  });
}
