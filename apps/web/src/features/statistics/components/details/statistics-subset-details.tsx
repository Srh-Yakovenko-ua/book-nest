"use client";

import { useTranslations } from "next-intl";

import type { CompletedReadsSubset } from "../../api/use-completed-reads-subset";

import { useCompletedReadsSubset } from "../../api/use-completed-reads-subset";
import { CompletedReadsList } from "./completed-reads-list";
import { DetailsError, DetailsLoading } from "./details-states";

export function StatisticsSubsetDetails({ filter, period }: CompletedReadsSubset) {
  const t = useTranslations("statistics.details.subset");
  const query = useCompletedReadsSubset({ filter, period });

  if (query.isPending) return <DetailsLoading label={t("loading")} />;
  if (query.isError) {
    return <DetailsError onRetry={() => void query.refetch()} title={t("error")} />;
  }

  return (
    <CompletedReadsList
      emptyTitle={t("empty")}
      hasMore={query.hasNextPage}
      isLoadingMore={query.isFetchingNextPage}
      onLoadMore={() => void query.fetchNextPage()}
      pages={query.data.pages}
    />
  );
}
