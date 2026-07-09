"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useRemoveFromReadingQueue } from "../api/use-book-actions";

type RemoveFromQueueDialogProps = {
  book: Pick<BookView, "id">;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function RemoveFromQueueDialog({ book, onOpenChange, open }: RemoveFromQueueDialogProps) {
  const t = useTranslations("books.details.queue");
  const tActions = useTranslations("books.actions");
  const remove = useRemoveFromReadingQueue();

  function onConfirm() {
    remove.mutate(book.id, {
      onError: () => toast.error(t("toast.removeError")),
      onSuccess: () => {
        toast.success(t("toast.removed"));
        onOpenChange(false);
      },
    });
  }

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!remove.isPending) onOpenChange(next);
      }}
      open={open}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="bookmark" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("removeDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("removeDialog.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>{tActions("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            variant="destructive"
          >
            {remove.isPending ? t("removeDialog.removing") : t("removeDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
