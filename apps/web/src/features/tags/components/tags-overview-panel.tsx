"use client";

import type { TagsSummaryView } from "@app/shared";

import { useTranslations } from "next-intl";

import type { SummaryCard } from "@/components/catalog/summary-cards";
import type { MobilePageOverviewTab } from "@/components/ui/mobile-page-overview-panel";

import { SummaryDetails } from "@/components/catalog/summary-mobile";
import { SummaryError } from "@/components/summary-error";
import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";

import type { UseTagQueryResult } from "../model/use-tag-query";
import type { TagsSummaryStatus } from "./tags-summary";

import {
  TagsAttentionBlock,
  TagsPaletteBlock,
  TagsStructureBlock,
  TagsUsageBlock,
} from "./tags-overview-blocks";

type TagsOverviewPanelProps = {
  cards: SummaryCard[];
  onRetry: () => void;
  query: UseTagQueryResult;
  status: TagsSummaryStatus;
  summary: TagsSummaryView | undefined;
};

export function TagsOverviewPanel({
  cards,
  onRetry,
  query,
  status,
  summary,
}: TagsOverviewPanelProps) {
  const t = useTranslations("tags.summary.panel");
  const panel = useMobilePageOverviewPanel();

  return (
    <div className="sm:hidden">
      <MobilePageOverviewTrigger label={t("trigger")} onClick={() => panel.setOpen(true)} />
      <MobilePageOverviewPanel
        closeLabel={t("close")}
        error={
          status === "error" ? (
            <SummaryError state={{ onRetry }} variant="embedded">
              {null}
            </SummaryError>
          ) : undefined
        }
        loading={status === "pending"}
        panel={panel}
        subtitle={t("subtitle")}
        tabs={summary === undefined ? undefined : tabs(summary)}
        title={t("title")}
      />
    </div>
  );

  function tabs(data: TagsSummaryView): MobilePageOverviewTab[] {
    return [
      {
        content: (
          <div className="flex flex-col gap-4">
            <SummaryDetails cards={cards} title={t("detailsTitle")} />
            <TagsUsageBlock summary={data} />
          </div>
        ),
        id: "overview",
        label: t("tabs.overview"),
      },
      {
        content: (
          <div className="flex flex-col gap-4">
            <TagsStructureBlock
              onToggleType={query.toggleType}
              selectedTypes={query.state.type}
              summary={data}
            />
            <TagsPaletteBlock
              onToggleColor={query.toggleColor}
              selectedColors={query.state.color}
              summary={data}
            />
          </div>
        ),
        id: "structure",
        label: t("tabs.structure"),
      },
      {
        badge: data.usageDistribution.unused,
        content: (
          <TagsAttentionBlock
            isShowingUnused={query.state.filter === "unused"}
            onShowUnused={() => panel.closeThen(() => query.setFilter("unused"))}
            summary={data}
          />
        ),
        id: "attention",
        label: t("tabs.attention"),
      },
    ];
  }
}
