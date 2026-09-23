"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { LibrarySummaryMobile } from "@/features/books/components/library-summary-mobile";

import type { TagCardItem, TagFilter, TagSort } from "../model/tags-derive";

import { useDeleteTag } from "../api/use-delete-tag";
import { useTagStats } from "../api/use-tag-stats";
import { filterTags, sortTags, TAG_SORT_DEFAULT, toTagCards } from "../model/tags-derive";
import { AddTagDialog } from "./add-tag-dialog";
import { DeleteTagDialog } from "./delete-tag-dialog";
import { EditTagDialog } from "./edit-tag-dialog";
import { TagsTab } from "./tags-tab";
import { TagsToolbar } from "./tags-toolbar";

export function Tags() {
  const t = useTranslations("tags");
  const tErrors = useTranslations("tags.errors");

  const tagStats = useTagStats();
  const deleteTag = useDeleteTag();

  const [search, setSearch] = useState("");
  const [tagSort, setTagSort] = useState<TagSort>(TAG_SORT_DEFAULT);
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<null | TagCardItem>(null);
  const [tagToDelete, setTagToDelete] = useState<null | TagCardItem>(null);

  const tagCards = toTagCards(tagStats.data ?? []);
  const visibleTags = sortTags({
    items: filterTags({ filter: tagFilter, items: tagCards, search }),
    sort: tagSort,
  });

  const summaryCards: LibrarySummaryCard[] = [
    { icon: "tag", iconTone: "tag", label: t("summary.tags"), value: tagCards.length },
  ];

  function clearFilters() {
    setSearch("");
    setTagFilter("all");
  }

  function confirmDeleteTag() {
    if (tagToDelete === null) return;
    deleteTag.mutate(tagToDelete.id, {
      onError: () => toast.error(tErrors("deleteFailed")),
      onSuccess: () => {
        toast.success(t("deleteDialog.success"));
        setTagToDelete(null);
      },
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <h1 className="font-heading text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-semibold text-ink">
                {t("page.title")}
              </h1>
              <TitleLeaf />
            </div>
            <p className="text-sm text-muted-foreground">{t("page.subtitle")}</p>
          </div>
          <Button className="self-start sm:self-auto" onClick={() => setAddOpen(true)}>
            <UiIcon name="plus" size={16} />
            {t("page.addTag")}
          </Button>
        </div>

        <LibrarySummaryMobile
          cards={summaryCards}
          className="sm:hidden"
          isLoading={tagStats.isPending}
        />

        <StatCard
          className="max-sm:hidden sm:max-w-sm"
          icon="tag"
          iconTone="tag"
          label={t("summary.tags")}
          size="compact"
          value={tagCards.length.toLocaleString()}
        />
      </header>

      <div className="flex flex-col gap-4">
        <TagsToolbar
          onSearchChange={setSearch}
          onTagFilterChange={setTagFilter}
          onTagSortChange={setTagSort}
          search={search}
          tagFilter={tagFilter}
          tagSort={tagSort}
        />

        <TagsTab
          allTags={tagCards}
          hasAnyTags={tagCards.length > 0}
          isError={tagStats.isError}
          isPending={tagStats.isPending}
          onAddTag={() => setAddOpen(true)}
          onClearFilters={clearFilters}
          onDeleteTag={setTagToDelete}
          onEditTag={setTagToEdit}
          onRetry={() => void tagStats.refetch()}
          tags={visibleTags}
        />

        <p className="flex items-start gap-2 rounded-lg border border-border bg-secondary/50 px-3.5 py-3 text-sm text-muted-foreground">
          <UiIcon aria-hidden className="mt-0.5 shrink-0 text-icon" name="info" size={16} />
          {t("page.hint")}
        </p>
      </div>

      <AddTagDialog onOpenChange={setAddOpen} open={addOpen} />
      <EditTagDialog onOpenChange={() => setTagToEdit(null)} tag={tagToEdit} />
      <DeleteTagDialog
        isDeleting={deleteTag.isPending}
        onConfirm={confirmDeleteTag}
        onOpenChange={() => setTagToDelete(null)}
        tag={tagToDelete}
      />
    </div>
  );
}
