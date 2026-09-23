import type { LibraryPublisherOverview } from "@app/shared";

import { PublisherOverviewLatest } from "./publisher-overview-latest";
import { PublisherOverviewReading } from "./publisher-overview-reading";
import { PublisherOverviewSeriesList } from "./publisher-overview-series";
import { PublisherOverviewWishlist } from "./publisher-overview-wishlist";

type PublisherOverviewContentProps = {
  overview: LibraryPublisherOverview;
};

const COLUMN_CLASS = "flex min-w-0 flex-col gap-6";

export function PublisherOverviewContent({ overview }: PublisherOverviewContentProps) {
  const latest =
    overview.latestBook === null ? null : <PublisherOverviewLatest book={overview.latestBook} />;
  const reading =
    overview.activeReading.length === 0 ? null : (
      <PublisherOverviewReading books={overview.activeReading} />
    );
  const wishlist =
    overview.wishlist.length === 0 ? null : <PublisherOverviewWishlist books={overview.wishlist} />;
  const series =
    overview.series.length === 0 ? null : <PublisherOverviewSeriesList series={overview.series} />;

  return (
    <>
      <div className="flex flex-col gap-6 lg:hidden" data-testid="publisher-overview-stacked">
        {latest}
        {reading}
        {wishlist}
        {series}
      </div>
      <div
        className="hidden gap-6 lg:grid lg:grid-cols-[56fr_44fr] lg:items-start"
        data-testid="publisher-overview-columns"
      >
        <div className={COLUMN_CLASS}>
          {latest}
          {series}
        </div>
        <div className={COLUMN_CLASS}>
          {reading}
          {wishlist}
        </div>
      </div>
    </>
  );
}
