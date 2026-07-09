"use client";

import type { BookListMembershipView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Multiselect } from "@/components/ui/multiselect";
import { Skeleton } from "@/components/ui/skeleton";

import type { ListDraft } from "../model/book-organization-fields";

import { useBookLists, useSetBookLists } from "../api/use-book-lists";
import {
  BOOK_LIST_IDS_MAX,
  BOOK_NEW_LISTS_MAX,
  draftListValue,
  splitListSelection,
} from "../model/book-organization-fields";
import { CreateListDialog } from "./create-list-dialog";

type BookListMembershipDialogProps = {
  bookId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type BookListMembershipFormProps = {
  bookId: string;
  initialListIds: string[];
  lists: BookListMembershipView[];
  onClose: () => void;
};

export function BookListMembershipDialog({
  bookId,
  onOpenChange,
  open,
}: BookListMembershipDialogProps) {
  const t = useTranslations("books.library.listDialog");
  const { data } = useBookLists(bookId, { enabled: open });
  const memberIds = data?.lists.filter((list) => list.isMember).map((list) => list.id) ?? [];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("membershipDescription")}</DialogDescription>
        </DialogHeader>

        {data === undefined ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-[2.875rem] w-full" />
            <Skeleton className="h-9 w-28" />
          </div>
        ) : (
          <BookListMembershipForm
            bookId={bookId}
            initialListIds={memberIds}
            key={memberIds.join(",")}
            lists={data.lists}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BookListMembershipForm({
  bookId,
  initialListIds,
  lists,
  onClose,
}: BookListMembershipFormProps) {
  const t = useTranslations("books.library.listDialog");
  const tToast = useTranslations("books.details.actions.toast");
  const listFieldId = useId();
  const setLists = useSetBookLists(bookId);
  const [listIds, setListIds] = useState(initialListIds);
  const [drafts, setDrafts] = useState<ListDraft[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const atMax = listIds.length + drafts.length >= BOOK_LIST_IDS_MAX;
  const atDraftsMax = drafts.length >= BOOK_NEW_LISTS_MAX;
  const isSubmitting = setLists.isPending;

  function handleConfirm() {
    setLists.mutate(
      { listIds, newLists: drafts },
      {
        onError: () => toast.error(tToast("error")),
        onSuccess: () => {
          toast.success(tToast("listsUpdated"));
          onClose();
        },
      },
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <Label htmlFor={listFieldId}>{t("listsLabel")}</Label>
        <Multiselect
          emptyText={t("empty")}
          id={listFieldId}
          onValueChange={(next) => {
            const result = splitListSelection({ drafts, selection: next });
            setListIds(result.listIds.slice(0, BOOK_LIST_IDS_MAX));
            setDrafts(result.newLists);
          }}
          options={[
            ...lists
              .filter((list) => !atMax || listIds.includes(list.id))
              .map((list) => ({ label: list.name, value: list.id })),
            ...drafts.map((draft) => ({
              label: draft.name,
              value: draftListValue(draft.name),
            })),
          ]}
          placeholder={t("placeholder")}
          searchPlaceholder={t("search")}
          value={[...listIds, ...drafts.map((draft) => draftListValue(draft.name))]}
        />

        <Button
          className="self-start"
          disabled={atMax || atDraftsMax}
          onClick={() => setCreateOpen(true)}
          size="sm"
          type="button"
          variant="secondary"
        >
          <UiIcon name="plus" size={16} />
          {t("createList")}
        </Button>
      </div>

      <DialogFooter>
        <Button disabled={isSubmitting} onClick={onClose} variant="secondary">
          {t("cancel")}
        </Button>
        <Button loading={isSubmitting} onClick={handleConfirm}>
          {t("save")}
        </Button>
      </DialogFooter>

      <CreateListDialog
        onConfirm={(draft) => setDrafts((current) => [...current, draft])}
        onOpenChange={setCreateOpen}
        open={createOpen}
      />
    </>
  );
}
