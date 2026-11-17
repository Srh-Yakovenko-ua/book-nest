"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { copyText } from "@/lib/copy-text";

import { useToggleFavoriteDedication } from "../api/use-toggle-favorite-dedication";

export type DedicationActions = {
  copy: (text: string) => Promise<boolean>;
  isTogglingFavorite: boolean;
  toggleFavorite: (book: BookView) => void;
};

type UseDedicationActionsOptions = {
  onFavoriteChanged?: (updated: BookView) => void;
};

export function useDedicationActions({
  onFavoriteChanged,
}: UseDedicationActionsOptions = {}): DedicationActions {
  const t = useTranslations("dedications");
  const favorite = useToggleFavoriteDedication();

  return {
    copy: async (text) => {
      const copied = await copyText(text);
      if (copied) {
        toast.success(t("copy.success"));
        return true;
      }
      toast.error(t("copy.error"));
      return false;
    },
    isTogglingFavorite: favorite.isPending,
    toggleFavorite: (book) => {
      void favorite
        .mutateAsync({ id: book.id, isFavoriteDedication: !book.isFavoriteDedication })
        .then(
          (updated) => {
            onFavoriteChanged?.(updated);
            toast.success(
              updated.isFavoriteDedication ? t("favorite.added") : t("favorite.removed"),
            );
          },
          () => toast.error(t("favorite.error")),
        );
    },
  };
}
