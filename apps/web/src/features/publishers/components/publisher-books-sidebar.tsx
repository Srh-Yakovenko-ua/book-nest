"use client";

import type { LibraryPublisherOverview } from "@app/shared";
import type { UseQueryResult } from "@tanstack/react-query";

import { useTranslations } from "next-intl";

import { hasPublisherOverviewBlocks, PublisherOverviewBlocks } from "./publisher-overview-blocks";
import { PublisherOverviewError } from "./publisher-overview-error";
import { PublisherOverviewSkeleton } from "./publisher-overview-skeleton";

type PublisherBooksSidebarProps = {
  overview: UseQueryResult<LibraryPublisherOverview>;
};

export function PublisherBooksSidebar({ overview }: PublisherBooksSidebarProps) {
  const t = useTranslations("publishers.details.overview");

  if (overview.data !== undefined && !hasPublisherOverviewBlocks(overview.data)) return null;

  return (
    <aside
      aria-busy={overview.isPending || overview.isFetching}
      aria-label={t("regionLabel")}
      className="flex flex-col gap-4 max-sm:hidden xl:sticky xl:top-6 xl:w-[19rem] xl:shrink-0"
    >
      <PublisherBooksSidebarBody overview={overview} />
    </aside>
  );
}

function PublisherBooksSidebarBody({ overview }: PublisherBooksSidebarProps) {
  if (overview.data !== undefined) return <PublisherOverviewBlocks overview={overview.data} />;
  if (overview.isError) {
    return (
      <div role="alert">
        <PublisherOverviewError onRetry={() => void overview.refetch()} />
      </div>
    );
  }
  return <PublisherOverviewSkeleton />;
}
