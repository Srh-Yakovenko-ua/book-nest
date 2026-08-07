"use client";

import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

import type { PageTabsItem } from "@/components/page-tabs";
import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { PageTabs, PageTabsPanel } from "@/components/page-tabs";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { LibrarySummaryMobile } from "@/features/books/components/library-summary-mobile";

import type { GenreFilter, GenreSort } from "../model/genres-derive";
import type { TagCardItem, TagFilter, TagSort } from "../model/tags-derive";

import { useDeleteTag } from "../api/use-delete-tag";
import { useGenreCatalog } from "../api/use-genre-catalog";
import { useGenreStats } from "../api/use-genre-stats";
import { useTagStats } from "../api/use-tag-stats";
import {
  filterGenres,
  GENRE_GROUP_ALL,
  GENRE_SORT_DEFAULT,
  genreGroupOptions,
  sortGenres,
  toGenreCards,
} from "../model/genres-derive";
import { genresTagsTabParser } from "../model/genres-tags-params";
import { filterTags, sortTags, TAG_SORT_DEFAULT, toTagCards } from "../model/tags-derive";
import { AddTagDialog } from "./add-tag-dialog";
import { DeleteTagDialog } from "./delete-tag-dialog";
import { EditTagDialog } from "./edit-tag-dialog";
import { GenresTab } from "./genres-tab";
import { GenresTagsToolbar } from "./genres-tags-toolbar";
import { TagsTab } from "./tags-tab";

const RESULTS_PANEL_ID = "genres-tags-results";

export function GenresTags() {
  const t = useTranslations("genresTags");
  const tErrors = useTranslations("genresTags.errors");

  const genreStats = useGenreStats();
  const genreCatalog = useGenreCatalog();
  const tagStats = useTagStats();
  const deleteTag = useDeleteTag();

  const [tab, setTab] = useQueryState("tab", genresTagsTabParser);
  const [search, setSearch] = useState("");
  const [genreSort, setGenreSort] = useState<GenreSort>(GENRE_SORT_DEFAULT);
  const [genreFilter, setGenreFilter] = useState<GenreFilter>("all");
  const [genreGroup, setGenreGroup] = useState<string>(GENRE_GROUP_ALL);
  const [tagSort, setTagSort] = useState<TagSort>(TAG_SORT_DEFAULT);
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [tagToEdit, setTagToEdit] = useState<null | TagCardItem>(null);
  const [tagToDelete, setTagToDelete] = useState<null | TagCardItem>(null);

  const genreCards = toGenreCards({
    genres: genreCatalog.data ?? [],
    stats: genreStats.data ?? [],
  });
  const visibleGenres = sortGenres({
    items: filterGenres({ filter: genreFilter, group: genreGroup, items: genreCards, search }),
    sort: genreSort,
  });

  const tagCards = toTagCards(tagStats.data ?? []);
  const visibleTags = sortTags({
    items: filterTags({ filter: tagFilter, items: tagCards, search }),
    sort: tagSort,
  });

  const genresPending = genreStats.isPending || genreCatalog.isPending;
  const genresError = genreStats.isError || genreCatalog.isError;

  const summaryCards: LibrarySummaryCard[] = [
    { icon: "hash", iconTone: "genre", label: t("summary.genres"), value: genreCards.length },
    { icon: "tag", iconTone: "tag", label: t("summary.tags"), value: tagCards.length },
  ];

  function clearFilters() {
    setSearch("");
    setGenreFilter("all");
    setGenreGroup(GENRE_GROUP_ALL);
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

  const tabItems: PageTabsItem[] = [
    { label: t("tabs.genres"), value: "genres" },
    { label: t("tabs.tags"), value: "tags" },
  ];

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
          isLoading={genresPending || tagStats.isPending}
        />

        <div className="grid grid-cols-2 gap-3 max-sm:hidden sm:gap-4">
          <StatCard
            icon="hash"
            iconTone="genre"
            label={t("summary.genres")}
            onClick={() => void setTab("genres")}
            size="compact"
            value={genreCards.length.toLocaleString()}
          />
          <StatCard
            icon="tag"
            iconTone="tag"
            label={t("summary.tags")}
            onClick={() => void setTab("tags")}
            size="compact"
            value={tagCards.length.toLocaleString()}
          />
        </div>
      </header>

      <div className="flex flex-col gap-4">
        <PageTabs
          items={tabItems}
          onValueChange={(value) => void setTab(value === "tags" ? "tags" : "genres")}
          panelId={RESULTS_PANEL_ID}
          value={tab}
        >
          <GenresTagsToolbar
            genreFilter={genreFilter}
            genreGroup={genreGroup}
            genreGroups={genreGroupOptions(genreCards)}
            genreSort={genreSort}
            onGenreFilterChange={setGenreFilter}
            onGenreGroupChange={setGenreGroup}
            onGenreSortChange={setGenreSort}
            onSearchChange={setSearch}
            onTagFilterChange={setTagFilter}
            onTagSortChange={setTagSort}
            search={search}
            tab={tab}
            tagFilter={tagFilter}
            tagSort={tagSort}
          />

          <PageTabsPanel value="genres">
            <GenresTab
              genres={visibleGenres}
              hasAnyGenres={genreCards.length > 0}
              isError={genresError}
              isPending={genresPending}
              onClearFilters={clearFilters}
              onRetry={() => {
                void genreStats.refetch();
                void genreCatalog.refetch();
              }}
            />
          </PageTabsPanel>

          <PageTabsPanel value="tags">
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
          </PageTabsPanel>
        </PageTabs>

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
