import type { PublisherOverviewSeries, SeriesStatus } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

import { PublisherOverviewSection } from "./publisher-overview-section";

const SERIES_STATUS_BADGE_VARIANT = {
  completed: "success",
  ongoing: "info",
  unknown: "secondary",
} as const satisfies Record<SeriesStatus, "info" | "secondary" | "success">;

type PublisherOverviewSeriesListProps = {
  series: PublisherOverviewSeries[];
};

export function PublisherOverviewSeriesList({ series }: PublisherOverviewSeriesListProps) {
  const t = useTranslations("publishers.details.overview");

  return (
    <PublisherOverviewSection title={t("sections.series")}>
      {series.map((entry) => (
        <li key={entry.id}>
          <SeriesRow series={entry} />
        </li>
      ))}
    </PublisherOverviewSection>
  );
}

function SeriesRow({ series }: { series: PublisherOverviewSeries }) {
  const t = useTranslations("publishers.details.overview");
  const tStatus = useTranslations("series.status");

  function readCopy() {
    if (series.readCount === 0) return t("seriesReadNone");
    if (series.readCount >= series.booksCount) return t("seriesReadAll");
    return t("seriesReadSome", { count: series.readCount });
  }

  return (
    <Link
      className="-mx-3 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      href={`/series/${series.id}`}
    >
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-icon"
      >
        <UiIcon name="layers" size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold text-foreground">{series.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {`${t("seriesBooks", { count: series.booksCount })} · ${readCopy()}`}
        </span>
      </span>
      <Badge variant={SERIES_STATUS_BADGE_VARIANT[series.status]}>{tStatus(series.status)}</Badge>
    </Link>
  );
}
