"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useAddToReadingQueue, useRemoveFromQueue } from "../api/use-reading-queue";

export function useRemoveFromQueueWithUndo() {
  const t = useTranslations("readingQueue");
  const remove = useRemoveFromQueue();
  const add = useAddToReadingQueue();

  function removeWithUndo(bookId: string, position: null | number) {
    remove.mutate(bookId, {
      onError: () => toast.error(t("remove.error")),
      onSuccess: () => {
        toast(
          t("remove.toast"),
          position === null
            ? undefined
            : {
                action: {
                  label: t("remove.undo"),
                  onClick: () =>
                    add.mutate(
                      { bookId, placement: "specific", position },
                      { onError: () => toast.error(t("add.errorToast")) },
                    ),
                },
              },
        );
      },
    });
  }

  return { isPending: remove.isPending, remove: removeWithUndo };
}
