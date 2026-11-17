"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useAddToReadingQueue, useRemoveFromQueue } from "../api/use-reading-queue";

export function useRemoveFromQueueWithUndo() {
  const t = useTranslations("readingQueue");
  const remove = useRemoveFromQueue();
  const add = useAddToReadingQueue();

  async function restoreToQueue(bookId: string, position: number) {
    try {
      await add.mutateAsync({ bookId, placement: "specific", position });
    } catch {
      toast.error(t("add.errorToast"));
    }
  }

  async function removeAndOfferUndo(bookId: string, position: null | number) {
    try {
      await remove.mutateAsync(bookId);
    } catch {
      toast.error(t("remove.error"));
      return;
    }
    toast(
      t("remove.toast"),
      position === null
        ? undefined
        : {
            action: {
              label: t("remove.undo"),
              onClick: () => void restoreToQueue(bookId, position),
            },
          },
    );
  }

  function removeWithUndo(bookId: string, position: null | number) {
    void removeAndOfferUndo(bookId, position);
  }

  return { isPending: remove.isPending, remove: removeWithUndo };
}
