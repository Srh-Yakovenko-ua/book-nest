"use client";

import type { TagCatalogListItem } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";

import type { TagsListState } from "../model/tags-list-state";

import { useTagsCatalog } from "../api/use-tags-catalog";
import { useTagsFacets } from "../api/use-tags-facets";
import { useTagsSummary } from "../api/use-tags-summary";
import { tagsListState } from "../model/tags-list-state";
import { useTagQuery } from "../model/use-tag-query";
import { useTagsSummaryCards } from "../model/use-tags-summary-cards";
import { AddTagDialog } from "./add-tag-dialog";
import { DeleteTagDialog } from "./delete-tag-dialog";
import { EditTagDialog } from "./edit-tag-dialog";
import { TagsCatalog } from "./tags-catalog";
import { TagsOverviewPanel } from "./tags-overview-panel";
import { TagsSidebar } from "./tags-sidebar";
import { TagsSummaryCards } from "./tags-summary";
import { TagsToolbar, TagsToolbarSkeleton } from "./tags-toolbar";

type TagDialog =
  | { kind: "add" }
  | { kind: "closed" }
  | { kind: "delete"; tag: TagCatalogListItem }
  | { kind: "edit"; tag: TagCatalogListItem };

const CLOSED_DIALOG: TagDialog = { kind: "closed" };

export function TagsView() {
  const t = useTranslations("tags");
  const query = useTagQuery();
  const catalog = useTagsCatalog(query.catalogParams);
  const facets = useTagsFacets(query.facetsParams);
  const summary = useTagsSummary();
  const summaryCards = useTagsSummaryCards(summary.data);
  const summaryStatus = summary.data === undefined ? summary.status : "success";
  const [dialog, setDialog] = useState<TagDialog>(CLOSED_DIALOG);

  const listState = tagsListState({
    catalog,
    criteria: {
      filter: query.state.filter,
      hasContextualCriteria: query.hasContextualCriteria,
      hasSearch: query.hasActiveSearch,
    },
    globalCounts:
      summary.data === undefined
        ? undefined
        : {
            totalTagsCount: summary.data.totalTagsCount,
            unusedCount: summary.data.usageDistribution.unused,
          },
  });

  function closeDialog() {
    setDialog(CLOSED_DIALOG);
  }

  function loadMore() {
    if (!catalog.hasNextPage || catalog.isFetchingNextPage) return;
    void catalog.fetchNextPage();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
              {t("page.title")}
            </h1>
            <TitleLeaf />
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {t("page.subtitle")}
          </p>
        </div>
        <Button className="self-start sm:self-auto" onClick={() => setDialog({ kind: "add" })}>
          <UiIcon name="plus" size={16} />
          {t("page.addTag")}
        </Button>
      </header>

      <TagsSummaryCards
        cards={summaryCards}
        onRetry={() => void summary.refetch()}
        status={summaryStatus}
      />

      <TagsOverviewPanel
        cards={summaryCards}
        onRetry={() => void summary.refetch()}
        query={query}
        status={summaryStatus}
        summary={summary.data}
      />

      {toolbarSlot(listState)}

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <section
          aria-labelledby="tags-catalog-title"
          className="flex min-w-0 flex-1 flex-col gap-4"
        >
          <h2 className="sr-only" id="tags-catalog-title">
            {t("catalog.title")}
          </h2>
          <TagsCatalog
            onAddTag={() => setDialog({ kind: "add" })}
            onClearAll={query.clearAll}
            onClearSearch={query.clearSearch}
            onDeleteTag={(tag) => setDialog({ kind: "delete", tag })}
            onEditTag={(tag) => setDialog({ kind: "edit", tag })}
            onLoadMore={loadMore}
            onRetry={() => void catalog.refetch()}
            onShowAll={() => query.setFilter("all")}
            state={listState}
          />
        </section>
        <TagsSidebar query={query} status={summaryStatus} summary={summary.data} />
      </div>

      <AddTagDialog
        onOpenChange={(open) => setDialog(open ? { kind: "add" } : CLOSED_DIALOG)}
        open={dialog.kind === "add"}
      />
      <EditTagDialog onOpenChange={closeDialog} tag={dialog.kind === "edit" ? dialog.tag : null} />
      <DeleteTagDialog
        onOpenChange={closeDialog}
        tag={dialog.kind === "delete" ? dialog.tag : null}
      />
    </div>
  );

  function toolbarSlot(state: TagsListState): ReactNode {
    if (state.kind === "loading" && catalog.data === undefined) return <TagsToolbarSkeleton />;
    if (state.kind === "first-use") return null;
    return <TagsToolbar query={query} quickCounts={facets.data?.quickCounts} />;
  }
}
