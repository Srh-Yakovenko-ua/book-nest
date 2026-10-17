"use client";

import type { CharacterFactView } from "@app/shared";

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

import type { CharacterFactsScope } from "../api/character-keys";

import { isCharacterFactGone } from "../api/character-fact-mutation-effects";
import { useDeleteCharacterFact } from "../api/use-delete-character-fact";

type DeleteCharacterFactDialogProps = {
  fact: CharacterFactView;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
  onDeleted: () => void;
  open: boolean;
  scope: CharacterFactsScope;
};

export function DeleteCharacterFactDialog({
  fact,
  onClose,
  onCloseAutoFocus,
  onDeleted,
  open,
  scope,
}: DeleteCharacterFactDialogProps) {
  const t = useTranslations("characters.facts.deleteDialog");
  const tToast = useTranslations("characters.facts.toast");
  const deleteFact = useDeleteCharacterFact();
  const isDeleting = deleteFact.isPending;

  function confirmDelete() {
    if (isDeleting) return;
    deleteFact.mutate(
      { ...scope, factId: fact.id },
      {
        onError: (error) => {
          if (!isCharacterFactGone(error)) {
            toast.error(tToast("deleteError"));
            return;
          }
          toast.warning(tToast("deletedElsewhere"));
          onDeleted();
        },
        onSuccess: () => {
          toast.success(tToast("deleted"));
          onDeleted();
        },
      },
    );
  }

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!next && !isDeleting) onClose();
      }}
      open={open}
    >
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus} size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="alert-triangle" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription className="wrap-anywhere">
            {t("description", { title: fact.title })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              confirmDelete();
            }}
            variant="destructive"
          >
            {isDeleting ? t("deleting") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
