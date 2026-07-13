"use client";

import type { CustomListCard, ListSort, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";

import { useDeleteList } from "../api/use-delete-list";
import { useLists } from "../api/use-lists";
import { deriveListsStats, filterLists, LIST_SORT_DEFAULT, sortLists } from "../model/lists-derive";
import { AllListsView } from "./all-lists-view";
import { CreateListDialog } from "./create-list-dialog";
import { DeleteListDialog } from "./delete-list-dialog";
import { EditListDialog } from "./edit-list-dialog";
import { ListsSidebar } from "./lists-sidebar";
import { ListsToolbar } from "./lists-toolbar";

export function AllLists() {
  const t = useTranslations("lists.manage.toast");
  const router = useRouter();
  const { data, isError, isPending, refetch } = useLists();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ListSort>(LIST_SORT_DEFAULT);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Nullable<CustomListCard>>(null);
  const [deleting, setDeleting] = useState<Nullable<CustomListCard>>(null);

  const deleteList = useDeleteList(deleting?.id ?? "");

  const allLists = (data?.pages ?? []).flatMap((page) => page.items);
  const stats = deriveListsStats(allLists);
  const visibleLists = sortLists(filterLists(allLists, search), sort);
  const hasAnyLists = allLists.length > 0;
  const hasActiveSearch = search.trim() !== "";

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
        hasActiveSearch={hasActiveSearch}
        hasAnyLists={hasAnyLists}
        isError={isError}
        isPending={isPending}
        lists={visibleLists}
        onClearSearch={() => setSearch("")}
        onCreateList={() => setCreateOpen(true)}
        onDeleteList={setDeleting}
        onEditList={setEditing}
        onOpenLibrary={() => router.push("/books")}
        onRetry={() => void refetch()}
        sidebar={<ListsSidebar onCreateList={() => setCreateOpen(true)} stats={stats} />}
        toolbar={
          <ListsToolbar
            onSearchChange={setSearch}
            onSearchClear={() => setSearch("")}
            onSortChange={setSort}
            search={search}
            sort={sort}
          />
        }
        totalCount={stats.totalLists}
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
