"use client";

import type { BookStoreLinkView } from "@app/shared";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  useAddStoreLink,
  useDeleteStoreLink,
  usePendingStoreLinkDeleteIds,
} from "../api/use-store-links";

export function useDeleteStoreLinkWithUndo(bookId: string) {
  const t = useTranslations("booksToBuy.storeLinks");
  const addLink = useAddStoreLink();
  const deleteLink = useDeleteStoreLink();
  const pendingLinkIds = usePendingStoreLinkDeleteIds();

  function restoreLink(link: BookStoreLinkView) {
    addLink
      .mutateAsync({
        bookId,
        payload: {
          currency: link.currency,
          price: link.price,
          storeName: link.storeName,
          url: link.url,
        },
      })
      .catch(() => toast.error(t("undoError")));
  }

  async function deleteAndOfferUndo(link: BookStoreLinkView) {
    try {
      await deleteLink.mutateAsync({ bookId, linkId: link.id });
    } catch {
      toast.error(t("deleteError"));
      return;
    }
    toast.success(t("deleted"), {
      action: {
        label: t("undo"),
        onClick: () => restoreLink(link),
      },
    });
  }

  return {
    deleteWithUndo: (link: BookStoreLinkView) => {
      void deleteAndOfferUndo(link);
    },
    pendingLinkIds,
  };
}
