"use client";

import type { BookStoreLinkView } from "@app/shared";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useAddStoreLink, useDeleteStoreLink } from "../api/use-store-links";

export function useDeleteStoreLinkWithUndo(bookId: string) {
  const t = useTranslations("booksToBuy.storeLinks");
  const addLink = useAddStoreLink();
  const deleteLink = useDeleteStoreLink();

  return (link: BookStoreLinkView) => {
    deleteLink.mutate(
      { bookId, linkId: link.id },
      {
        onError: () => toast.error(t("deleteError")),
        onSuccess: () =>
          toast.success(t("deleted"), {
            action: {
              label: t("undo"),
              onClick: () =>
                addLink.mutate(
                  {
                    bookId,
                    payload: {
                      currency: link.currency,
                      price: link.price,
                      storeName: link.storeName,
                      url: link.url,
                    },
                  },
                  { onError: () => toast.error(t("undoError")) },
                ),
            },
          }),
      },
    );
  };
}
