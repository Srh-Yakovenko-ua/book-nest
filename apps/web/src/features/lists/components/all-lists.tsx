"use client";

import type { CustomListCard, ListSort, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";

import type { ListAttentionReason } from "../model/lists-derive";

import { useDeleteList } from "../api/use-delete-list";
import { useLists } from "../api/use-lists";
import { useListsSummary } from "../api/use-lists-summary";
import {
  countListsAttention,
  filterLists,
  filterListsByAttention,
  LIST_SORT_DEFAULT,
  sortLists,
} from "../model/lists-derive";
import { AllListsView } from "./all-lists-view";
import { CreateListDialog } from "./create-list-dialog";
import { DeleteListDialog } from "./delete-list-dialog";
import { EditListDialog } from "./edit-list-dialog";
import { ListsSidebar } from "./lists-sidebar";
import { ListsSummaryCards } from "./lists-summary-cards";
import { ListsToolbar } from "./lists-toolbar";

export function AllLists() {
  const t = useTranslations("lists.manage.toast");
  const router = useRouter();
  const { data, isError, isPending, refetch } = useLists();
  const summary = useListsSummary();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ListSort>(LIST_SORT_DEFAULT);
  const [attention, setAttention] = useState<Nullable<ListAttentionReason>>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Nullable<CustomListCard>>(null);
  const [deleting, setDeleting] = useState<Nullable<CustomListCard>>(null);

  const deleteList = useDeleteList(deleting?.id ?? "");

  const allLists = (data?.pages ?? []).flatMap((page) => page.items);
  const attentionCounts = countListsAttention(allLists);
  const visibleLists = sortLists(
    filterListsByAttention(filterLists(allLists, search), attention),
    sort,
  );
  const hasAnyLists = allLists.length > 0;
  const hasActiveFilters = search.trim() !== "" || attention !== null;

  function clearFilters() {
    setSearch("");
    setAttention(null);
  }

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
        hasActiveFilters={hasActiveFilters}
        hasAnyLists={hasAnyLists}
        isError={isError}
        isPending={isPending}
        lists={visibleLists}
        onClearFilters={clearFilters}
        onCreateList={() => setCreateOpen(true)}
        onDeleteList={setDeleting}
        onEditList={setEditing}
        onOpenLibrary={() => router.push("/books")}
        onRetry={() => void refetch()}
        sidebar={
          <ListsSidebar
            activeAttention={attention}
            attentionCounts={attentionCounts}
            isLoading={isPending}
            onAttentionSelect={(reason) =>
              setAttention((current) => (current === reason ? null : reason))
            }
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
            onSearchChange={setSearch}
            onSearchClear={() => setSearch("")}
            onSortChange={setSort}
            search={search}
            sort={sort}
          />
        }
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
