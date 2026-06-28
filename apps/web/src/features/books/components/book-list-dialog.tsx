"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

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

import type { ListDraft } from "../model/book-organization-fields";

import { useListsSearch } from "../api/use-lists-search";
import { BOOK_LIST_IDS_MAX, BOOK_NEW_LISTS_MAX } from "../model/book-organization-fields";
import { CreateListDialog } from "./create-list-dialog";

type BookListDialogProps = {
  bookCount: number;
  onConfirm: (input: { listIds: string[]; newLists: ListDraft[] }) => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function BookListDialog({ bookCount, onConfirm, onOpenChange, open }: BookListDialogProps) {
  const t = useTranslations("books.library.listDialog");
  const listFieldId = useId();
  const { data: lists = [] } = useListsSearch("");
  const [listIds, setListIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<ListDraft[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const atMax = listIds.length + drafts.length >= BOOK_LIST_IDS_MAX;
  const atDraftsMax = drafts.length >= BOOK_NEW_LISTS_MAX;
  const canConfirm = (listIds.length > 0 || drafts.length > 0) && !isSubmitting;

  function reset() {
    setListIds([]);
    setDrafts([]);
  }

  async function handleConfirm() {
    setIsSubmitting(true);
    try {
      await onConfirm({ listIds, newLists: drafts });
      reset();
      onOpenChange(false);
    } catch {
      return;
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (isSubmitting) return;
        if (!next) reset();
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { count: bookCount })}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Label htmlFor={listFieldId}>{t("listsLabel")}</Label>
          <Multiselect
            emptyText={t("empty")}
            id={listFieldId}
            onValueChange={(next) => setListIds(next.slice(0, BOOK_LIST_IDS_MAX))}
            options={lists
              .filter((list) => !atMax || listIds.includes(list.id))
              .map((list) => ({ label: list.name, value: list.id }))}
            placeholder={t("placeholder")}
            searchPlaceholder={t("search")}
            value={listIds}
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

          {drafts.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {drafts.map((draft, index) => (
                <li
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 py-1 pr-1.5 pl-3 text-sm font-medium text-primary"
                  key={`${draft.name}-${index}`}
                >
                  <UiIcon name="plus" size={14} />
                  <span className="truncate">{draft.name}</span>
                  <button
                    aria-label={t("removeDraft", { name: draft.name })}
                    className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border border-transparent text-primary transition-colors hover:bg-primary/20 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    onClick={() => setDrafts(drafts.filter((_, position) => position !== index))}
                    type="button"
                  >
                    <UiIcon name="x" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <DialogFooter>
          <Button disabled={isSubmitting} onClick={() => onOpenChange(false)} variant="secondary">
            {t("cancel")}
          </Button>
          <Button
            disabled={!canConfirm}
            loading={isSubmitting}
            onClick={() => void handleConfirm()}
          >
            {t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>

      <CreateListDialog
        onConfirm={(draft) => setDrafts((current) => [...current, draft])}
        onOpenChange={setCreateOpen}
        open={createOpen}
      />
    </Dialog>
  );
}
