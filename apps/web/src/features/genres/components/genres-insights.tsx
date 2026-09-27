"use client";

import type { GenresOverviewView } from "@app/shared";

import { useTranslations } from "next-intl";

import {
  MobilePageOverviewPanel,
  MobilePageOverviewTrigger,
  useMobilePageOverviewPanel,
} from "@/components/ui/mobile-page-overview-panel";
import { Skeleton } from "@/components/ui/skeleton";

import { GenreInsightBlocks } from "./genre-insight-blocks";

type GenresInsightsProps = {
  overview: GenresOverviewView;
};

const INSIGHTS_SKELETON_BLOCKS = ["dormant", "newForYou", "unrated"] as const;

export function GenresInsightsPanel({ overview }: GenresInsightsProps) {
  const t = useTranslations("genres.insights");
  const panel = useMobilePageOverviewPanel();

  return (
    <>
      <MobilePageOverviewTrigger
        icon="sparkles"
        label={t("trigger")}
        onClick={() => panel.setOpen(true)}
      />
      <MobilePageOverviewPanel
        closeLabel={t("close")}
        panel={panel}
        subtitle={t("subtitle")}
        title={t("title")}
      >
        <div className="flex flex-col gap-4">
          <GenreInsightBlocks overview={overview} />
        </div>
      </MobilePageOverviewPanel>
    </>
  );
}

export function GenresInsightsSidebar({ overview }: GenresInsightsProps) {
  const t = useTranslations("genres.insights");

  return (
    <aside
      aria-label={t("title")}
      className="hidden min-w-0 xl:sticky xl:top-6 xl:flex xl:w-[19rem] xl:shrink-0 xl:flex-col xl:gap-4"
    >
      <GenreInsightBlocks overview={overview} />
    </aside>
  );
}

export function GenresInsightsSidebarSkeleton() {
  return (
    <div
      aria-hidden
      className="hidden min-w-0 xl:flex xl:w-[19rem] xl:shrink-0 xl:flex-col xl:gap-4"
      data-slot="genres-insights-placeholder"
    >
      {INSIGHTS_SKELETON_BLOCKS.map((block) => (
        <div
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
          key={block}
        >
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 2 }, (_, row) => (
            <div className="flex items-center gap-3" key={row}>
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
