"use client";

import type { ReadingStatisticsOverview } from "@app/shared";

import type { UseStatisticsViewResult } from "../../model/use-statistics-view";

import { StatisticsFocusTarget } from "../statistics-focus-target";
import { StatisticsPresenceGate } from "../statistics-presence-gate";
import { StatisticsReadingEmpty } from "../statistics-reading-empty";
import { AuthorsSection } from "../tastes/authors-section";
import { DiscoveriesSection } from "../tastes/discoveries-section";
import { GenresSection } from "../tastes/genres-section";
import { LanguagesSection } from "../tastes/languages-section";
import { PublishersSection } from "../tastes/publishers-section";
import { RatingsSection } from "../tastes/ratings-section";

export function StatisticsTastesTab({
  onShowAllTime,
  overview,
  view,
}: {
  onShowAllTime: () => void;
  overview: ReadingStatisticsOverview;
  view: UseStatisticsViewResult;
}) {
  return (
    <StatisticsPresenceGate
      overview={overview}
      renderAbsent={(presence) => (
        <StatisticsReadingEmpty
          onShowAllTime={onShowAllTime}
          presence={presence}
          signal="completedReads"
        />
      )}
      signal="completedReads"
    >
      <StatisticsFocusTarget isTarget={view.section === "ratings"}>
        <RatingsSection ratings={overview.ratings} />
      </StatisticsFocusTarget>

      <div className="@container flex flex-col gap-4">
        <div className="grid grid-cols-1 items-start gap-4 @min-[41rem]:grid-cols-2">
          <GenresSection genres={overview.genres} />
          <AuthorsSection authors={overview.authors} />
        </div>
        <div className="grid grid-cols-1 items-start gap-4 @min-[41rem]:grid-cols-5">
          <div className="min-w-0 @min-[41rem]:col-span-3">
            <PublishersSection publishers={overview.publishers} />
          </div>
          <div className="min-w-0 @min-[41rem]:col-span-2">
            <LanguagesSection languages={overview.languages} />
          </div>
        </div>
      </div>

      {overview.period.kind === "all_time" ? null : (
        <DiscoveriesSection discoveries={overview.discoveries} />
      )}
    </StatisticsPresenceGate>
  );
}
