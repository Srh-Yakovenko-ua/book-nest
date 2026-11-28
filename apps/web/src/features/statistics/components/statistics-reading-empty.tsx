"use client";

import { useTranslations } from "next-intl";

import type { UiIconName } from "@/components/icons";
import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { BOOK_CREATE_PATH } from "@/features/books/model/book-create-href";
import { useRouter } from "@/i18n/navigation";

import type { StatisticsPresenceSignal } from "../model/statistics-reading-presence";
import type { StatisticsAbsentPresence } from "./statistics-presence-gate";

type ReadingEmptyCase = "noBooks" | "periodEmpty" | "withBooks";

type ReadingEmptyNextStep = Exclude<ReadingEmptyCase, "periodEmpty">;

const READING_EMPTY = {
  copy: {
    completedReads: {
      noBooks: "noCompletedReads.noBooks",
      periodEmpty: "noCompletedReads.periodEmpty",
      withBooks: "noCompletedReads.withBooks",
    },
    reading: {
      noBooks: "noReading.noBooks",
      periodEmpty: "periodEmpty",
      withBooks: "noReading.withBooks",
    },
  },
  destination: {
    noBooks: BOOK_CREATE_PATH,
    withBooks: "/books",
  },
  icon: {
    noBooks: "plus",
    periodEmpty: "chart",
    withBooks: "pages",
  },
} as const satisfies {
  copy: Record<StatisticsPresenceSignal, Record<ReadingEmptyCase, string>>;
  destination: Record<ReadingEmptyNextStep, string>;
  icon: Record<ReadingEmptyCase, UiIconName>;
};

export function StatisticsReadingEmpty({
  onShowAllTime,
  presence,
  signal,
}: {
  onShowAllTime: () => void;
  presence: StatisticsAbsentPresence;
  signal: StatisticsPresenceSignal;
}) {
  const t = useTranslations("statistics.states");
  const router = useRouter();
  const emptyCase = toReadingEmptyCase(presence);
  const copy = READING_EMPTY.copy[signal][emptyCase];

  const entry: EmptyStateEntry = {
    desc: t(`${copy}.description`),
    illu: "empty-library",
    primary: { icon: READING_EMPTY.icon[emptyCase], label: t(`${copy}.action`) },
    title: t(`${copy}.title`),
  };

  const onPrimary =
    emptyCase === "periodEmpty"
      ? onShowAllTime
      : () => router.push(READING_EMPTY.destination[emptyCase]);

  return <EmptyState onPrimary={onPrimary} state={entry} />;
}

function toReadingEmptyCase(presence: StatisticsAbsentPresence): ReadingEmptyCase {
  if (presence.kind === "period_empty") return "periodEmpty";
  return presence.hasBooks ? "withBooks" : "noBooks";
}
