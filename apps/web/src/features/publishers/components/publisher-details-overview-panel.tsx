"use client";

import type { LibraryPublisherOverview } from "@app/shared";
import type { UseQueryResult } from "@tanstack/react-query";

import { useTranslations } from "next-intl";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";

import { hasPublisherOverviewBlocks, PublisherOverviewBlocks } from "./publisher-overview-blocks";
import { PublisherOverviewError } from "./publisher-overview-error";

type PublisherDetailsOverviewPanelProps = {
  overview: UseQueryResult<LibraryPublisherOverview>;
};

export function PublisherDetailsOverviewPanel({ overview }: PublisherDetailsOverviewPanelProps) {
  const t = useTranslations("publishers.details.overview.panel");
  const panel = useMobilePageOverviewPanel();
  const { data } = overview;

  if (data !== undefined && !hasPublisherOverviewBlocks(data)) return null;

  return (
    <div className="sm:hidden">
      <MobilePageOverviewTrigger
        icon="book-open-text"
        label={t("trigger")}
        onClick={() => panel.setOpen(true)}
      />

      <MobilePageOverviewPanel
        closeLabel={t("close")}
        error={
          overview.isError ? (
            <PublisherOverviewError onRetry={() => void overview.refetch()} />
          ) : undefined
        }
        loading={overview.isPending}
        panel={panel}
        subtitle={t("subtitle")}
        title={t("title")}
      >
        {data === undefined ? null : (
          <div className="flex flex-col gap-4">
            <PublisherOverviewBlocks overview={data} />
          </div>
        )}
      </MobilePageOverviewPanel>
    </div>
  );
}
