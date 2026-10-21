"use client";

import type { CompletedReadRef } from "@app/shared";

import { useTranslations } from "next-intl";

import { CompletedReadCard } from "../completed-read-card";
import { StatisticsSection } from "../statistics-section";
import { StatisticsSectionState } from "../statistics-states";

export function StatisticsRecentReads({ reads }: { reads: readonly CompletedReadRef[] }) {
  const t = useTranslations("statistics.recentReads");

  return (
    <StatisticsSection title={t("title")}>
      {reads.length === 0 ? (
        <StatisticsSectionState kind="empty" title={t("empty")} />
      ) : (
        <div
          aria-label={t("title")}
          className="-m-1 snap-x snap-mandatory scroll-px-1 overflow-x-auto rounded-lg p-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          role="region"
          tabIndex={0}
        >
          <ul className="flex gap-3 sm:gap-4">
            {reads.map((read) => (
              <li className="w-28 shrink-0 snap-start sm:w-32" key={read.readingCycleId}>
                <CompletedReadCard read={read} variant="recent" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </StatisticsSection>
  );
}
