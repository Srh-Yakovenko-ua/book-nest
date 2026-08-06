"use client";

import type { CustomListCard, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";

import { useDeleteList } from "../api/use-delete-list";
import { useLists } from "../api/use-lists";
import { useListsSummary } from "../api/use-lists-summary";
import { useListsQuery } from "../model/use-lists-query";
import { AllListsView } from "./all-lists-view";
import { CreateListDialog } from "./create-list-dialog";
import { DeleteListDialog } from "./delete-list-dialog";
import { EditListDialog } from "./edit-list-dialog";
import { ListsSidebar } from "./lists-sidebar";
import { ListsSummaryCards } from "./lists-summary-cards";
import { ListsToolbar } from "./lists-toolbar";

export function AllLists() {
  const t = useTranslations("lists.manage.toast");
  const tCatalog = useTranslations("lists.catalog");
  const router = useRouter();
  const lists = useListsQuery();
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isError,
    isFetchingNextPage,
    isFetchNextPageError,
    isPending,
    refetch,
  } = useLists(lists.listParams);
  const summary = useListsSummary();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Nullable<CustomListCard>>(null);
  const [deleting, setDeleting] = useState<Nullable<CustomListCard>>(null);

  const deleteList = useDeleteList(deleting?.id ?? "");

  const pages = data?.pages ?? [];
  const visibleLists = pages.flatMap((page) => page.items);
  const totalCount = pages[0]?.totalCount ?? 0;
  const attentionCounts = {
    empty: summary.data?.emptyListCount ?? 0,
    no_description: summary.data?.noDescriptionListCount ?? 0,
    stale: summary.data?.staleListCount ?? 0,
  };
  const hasAnyLists = totalCount > 0 || lists.hasActiveFilters;

  function confirmDelete() {
    deleteList.mutate(undefined, {
      onError: () => toast.error(t("error")),
      onSuccess: () => {
        toast.success(t("deleted"));
        setDeleting(null);
      },
    });
  }

  return (
    <>
      <AllListsView
        allShownLabel={tCatalog("allShown")}
        hasActiveFilters={lists.hasActiveFilters}
        hasAnyLists={hasAnyLists}
        hasNextPage={hasNextPage}
        isError={isError}
        isFetchingNextPage={isFetchingNextPage}
        isLoadMoreError={isFetchNextPageError}
        isPending={isPending}
        lists={visibleLists}
        loadMoreErrorLabel={tCatalog("loadMoreError")}
        loadMoreLabel={tCatalog("loadMore")}
        onClearFilters={lists.clearFilters}
        onCreateList={() => setCreateOpen(true)}
        onDeleteList={setDeleting}
        onEditList={setEditing}
        onLoadMore={() => void fetchNextPage()}
        onOpenLibrary={() => router.push("/books")}
        onRetry={() => void refetch()}
        sidebar={
          <ListsSidebar
            activeAttention={lists.state.attention}
            attentionCounts={attentionCounts}
            isLoading={summary.isPending}
            onAttentionSelect={lists.toggleAttention}
          />
        }
        summary={
          <ListsSummaryCards
            isError={summary.isError}
            isLoading={summary.isPending}
            summary={summary.data}
          />
        }
        toolbar={
          <ListsToolbar
            counter={
              isPending || isError || visibleLists.length === 0
                ? undefined
                : tCatalog("counter", { shown: visibleLists.length, total: totalCount })
            }
            onClearFilters={lists.clearFilters}
            onSearchChange={lists.setSearch}
            onSortChange={lists.setSort}
            onViewChange={lists.setView}
            setState={lists.setState}
            state={lists.state}
          />
        }
        view={lists.state.view}
      />

      <CreateListDialog onOpenChange={setCreateOpen} open={createOpen} />

      {editing === null ? null : (
        <EditListDialog
          list={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          open
        />
      )}

      <DeleteListDialog
        isDeleting={deleteList.isPending}
        onConfirm={confirmDelete}
        onOpenChange={(open) => {
          if (deleteList.isPending) return;
          if (!open) setDeleting(null);
        }}
        open={deleting !== null}
      />
    </>
  );
}
