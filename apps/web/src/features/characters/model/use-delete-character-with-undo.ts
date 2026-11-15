"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useRestoreCharacter } from "../api/use-restore-character";
import { useSoftDeleteCharacter } from "../api/use-soft-delete-character";

export function useDeleteCharacterWithUndo() {
  const t = useTranslations("characters.toast");
  const softDelete = useSoftDeleteCharacter();
  const restore = useRestoreCharacter();

  async function restoreWithFeedback(characterId: string) {
    try {
      await restore.mutateAsync(characterId);
    } catch {
      toast.error(t("restoreError"));
      return;
    }
    toast.success(t("restored"));
  }

  async function softDeleteAndOfferUndo(characterId: string, onDeleted?: () => void) {
    try {
      await softDelete.mutateAsync(characterId);
    } catch {
      toast.error(t("deleteError"));
      return;
    }
    onDeleted?.();
    toast(t("deleted"), {
      action: {
        label: t("undo"),
        onClick: () => void restoreWithFeedback(characterId),
      },
    });
  }

  function deleteWithUndo(characterId: string, onDeleted?: () => void) {
    void softDeleteAndOfferUndo(characterId, onDeleted);
  }

  return { deleteWithUndo, isPending: softDelete.isPending };
}
