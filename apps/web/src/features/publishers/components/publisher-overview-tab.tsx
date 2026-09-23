"use client";

import type { LibraryPublisherOverview } from "@app/shared";
import type { UseQueryResult } from "@tanstack/react-query";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";

import { PublisherOverviewContent } from "./publisher-overview-content";
import { PublisherOverviewError } from "./publisher-overview-error";
import { PublisherOverviewSkeleton } from "./publisher-overview-skeleton";

type PublisherOverviewTabProps = {
  booksCount: number;
  onAddBook: () => void;
  overview: UseQueryResult<LibraryPublisherOverview>;
};

export function PublisherOverviewTab({
  booksCount,
  onAddBook,
  overview,
}: PublisherOverviewTabProps) {
  const t = useTranslations("publishers.details.overview");

  if (booksCount === 0) {
    const emptyState: EmptyStateEntry = {
      desc: t("empty.description"),
      illu: "empty-library",
      illuSize: "sm",
      primary: { icon: "plus", label: t("empty.cta") },
      title: t("empty.title"),
    };
    return <EmptyState onPrimary={onAddBook} state={emptyState} />;
  }

  return (
    <div aria-busy={overview.isPending} aria-label={t("regionLabel")} role="region">
      <PublisherOverviewBody overview={overview} />
    </div>
  );
}

function PublisherOverviewBody({
  overview,
}: {
  overview: UseQueryResult<LibraryPublisherOverview>;
}) {
  if (overview.data !== undefined) return <PublisherOverviewContent overview={overview.data} />;
  if (overview.isError) return <PublisherOverviewError onRetry={() => void overview.refetch()} />;
  return <PublisherOverviewSkeleton />;
}
