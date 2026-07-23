"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { useRestoreCharacter } from "../api/use-restore-character";
import { useSoftDeleteCharacter } from "../api/use-soft-delete-character";

export function useDeleteCharacterWithUndo() {
  const t = useTranslations("characters.toast");
  const softDelete = useSoftDeleteCharacter();
  const restore = useRestoreCharacter();

  function deleteWithUndo(characterId: string, onDeleted?: () => void) {
    softDelete.mutate(characterId, {
      onError: () => toast.error(t("deleteError")),
      onSuccess: () => {
        onDeleted?.();
        toast(t("deleted"), {
          action: {
            label: t("undo"),
            onClick: () =>
              restore.mutate(characterId, {
                onError: () => toast.error(t("restoreError")),
                onSuccess: () => toast.success(t("restored")),
              }),
          },
        });
      },
    });
  }

  return { deleteWithUndo, isPending: softDelete.isPending };
}
