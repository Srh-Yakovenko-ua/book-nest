"use client";

import type { Nullable } from "@app/shared";

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

import { useRemoveRelationshipBookState } from "../api/use-remove-relationship-book-state";
import { isRelationshipGone } from "../model/relationship-save-error";

type RemoveRelationshipBookStateDialogProps = {
  bookId: string;
  bookTitle: Nullable<string>;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  onRemoved: () => void;
  open: boolean;
  relationshipId: string;
};

export function RemoveRelationshipBookStateDialog({
  bookId,
  bookTitle,
  onClose,
  onCloseAutoFocus,
  onRemoved,
  open,
  relationshipId,
}: RemoveRelationshipBookStateDialogProps) {
  const t = useTranslations("relationships.removeBookStateDialog");
  const tToast = useTranslations("relationships.toast");
  const removeBookState = useRemoveRelationshipBookState();
  const isRemoving = removeBookState.isPending;

  function confirmRemove() {
    if (isRemoving) return;
    removeBookState.mutate(
      { bookId, relationshipId },
      {
        onError: (error) => {
          if (!isRelationshipGone(error)) {
            toast.error(tToast("removeBookStateError"));
            return;
          }
          toast.warning(tToast("bookStateGone"));
          onRemoved();
        },
        onSuccess: () => {
          toast.success(tToast("bookStateRemoved"));
          onRemoved();
        },
      },
    );
  }

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!next && !isRemoving) onClose();
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
            {bookTitle === null ? t("descriptionUnknown") : t("description", { book: bookTitle })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isRemoving}
            onClick={(event) => {
              event.preventDefault();
              confirmRemove();
            }}
            variant="destructive"
          >
            {isRemoving ? t("removing") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
