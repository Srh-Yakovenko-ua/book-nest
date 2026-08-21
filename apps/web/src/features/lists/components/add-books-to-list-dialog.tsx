"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookMultiSelectPicker } from "@/features/books/components/book-multi-select-picker";

import { useAddBooksToList } from "../api/use-list-membership";

type AddBooksToListDialogProps = {
  listId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AddBooksToListDialog({ listId, onOpenChange, open }: AddBooksToListDialogProps) {
  const t = useTranslations("lists.addBooks");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("subtitle")}</DialogDescription>
        </DialogHeader>
        {open ? <AddBooksForm listId={listId} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddBooksForm({ listId, onDone }: { listId: string; onDone: () => void }) {
  const t = useTranslations("lists.addBooks");
  const tToast = useTranslations("lists.details.toast");
  const [selected, setSelected] = useState<BookView[]>([]);
  const addBooks = useAddBooksToList(listId);

  function submit() {
    if (selected.length === 0) return;
    addBooks.mutate(
      { bookIds: selected.map((book) => book.id) },
      {
        onError: () => toast.error(tToast("error")),
        onSuccess: (result) => {
          toast.success(t("toast", { count: result.added }));
          onDone();
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <BookMultiSelectPicker
        baseParams={{ notInList: listId }}
        labels={{
          clear: t("clear"),
          empty: t("empty"),
          emptySelected: t("emptySelected"),
          library: t("library"),
          loadMore: t("loadMore"),
          removeSelected: t("removeSelected"),
          search: t("search"),
          selected: (count) => t("selected", { count }),
          selectLoaded: (count) => t("selectLoaded", { count }),
        }}
        onSelectedChange={setSelected}
        selected={selected}
      />
      <div className="flex justify-end">
        <Button
          disabled={selected.length === 0 || addBooks.isPending}
          loading={addBooks.isPending}
          onClick={submit}
        >
          {t("submit")}
        </Button>
      </div>
    </div>
  );
}
