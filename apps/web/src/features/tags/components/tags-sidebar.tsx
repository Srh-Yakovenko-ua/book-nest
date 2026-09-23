"use client";

import type { TagsSummaryView } from "@app/shared";

import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

import type { UseTagQueryResult } from "../model/use-tag-query";
import type { TagsSummaryStatus } from "./tags-summary";

import {
  TagsAttentionBlock,
  TagsPaletteBlock,
  TagsStructureBlock,
  TagsUsageBlock,
} from "./tags-overview-blocks";

type TagsSidebarProps = {
  query: UseTagQueryResult;
  status: TagsSummaryStatus;
  summary: TagsSummaryView | undefined;
};

const TAGS_SIDEBAR = {
  className:
    "min-w-0 gap-4 max-sm:hidden sm:grid sm:grid-cols-2 xl:sticky xl:top-6 xl:flex xl:w-[19rem] xl:shrink-0 xl:flex-col",
  skeletonBlocks: ["attention", "structure", "usage", "palette"],
} as const;

export function TagsSidebar({ query, status, summary }: TagsSidebarProps) {
  const t = useTranslations("tags.sidebar");

  if (status === "error") return null;
  if (status === "pending" || summary === undefined) return <TagsSidebarSkeleton />;

  return (
    <aside aria-label={t("label")} className={TAGS_SIDEBAR.className}>
      <TagsAttentionBlock onShowUnused={() => query.setFilter("unused")} summary={summary} />
      <TagsStructureBlock
        onToggleType={query.toggleType}
        selectedTypes={query.state.type}
        summary={summary}
      />
      <TagsUsageBlock summary={summary} />
      <TagsPaletteBlock
        onToggleColor={query.toggleColor}
        selectedColors={query.state.color}
        summary={summary}
      />
    </aside>
  );
}

function TagsSidebarSkeleton() {
  return (
    <div aria-hidden className={TAGS_SIDEBAR.className} data-slot="tags-sidebar-placeholder">
      {TAGS_SIDEBAR.skeletonBlocks.map((block) => (
        <div
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
          key={block}
        >
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }, (_, row) => (
            <div className="flex flex-col gap-1.5" key={row}>
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
