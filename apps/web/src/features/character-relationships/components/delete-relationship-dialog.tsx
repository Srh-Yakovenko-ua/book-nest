"use client";

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

import { useDeleteRelationship } from "../api/use-delete-relationship";
import { useRelationshipEditable } from "../api/use-relationship-editable";
import { isRelationshipGone } from "../model/relationship-save-error";

type DeleteRelationshipDialogProps = {
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
  onDeleted?: () => void;
  open: boolean;
  relationshipId: string;
};

export function DeleteRelationshipDialog({
  onClose,
  onCloseAutoFocus,
  onDeleted,
  open,
  relationshipId,
}: DeleteRelationshipDialogProps) {
  const t = useTranslations("relationships.deleteDialog");
  const tToast = useTranslations("relationships.toast");
  const deleteRelationship = useDeleteRelationship();
  const editable = useRelationshipEditable({
    enabled: open && deleteRelationship.isIdle,
    relationshipId,
  });
  const isDeleting = deleteRelationship.isPending;
  const relationship = editable.data;

  function finish() {
    onDeleted?.();
    onClose();
  }

  function confirmDelete() {
    if (isDeleting) return;
    deleteRelationship.mutate(relationshipId, {
      onError: (error) => {
        if (!isRelationshipGone(error)) {
          toast.error(tToast("deleteError"));
          return;
        }
        toast.warning(tToast("deletedElsewhere"));
        finish();
      },
      onSuccess: () => {
        toast.success(tToast("deleted"));
        finish();
      },
    });
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
          <AlertDialogDescription className="flex flex-col gap-2 wrap-anywhere">
            <span>
              {relationship === undefined
                ? t("descriptionUnknown")
                : t("description", {
                    source: relationship.sourceCharacterName,
                    target: relationship.targetCharacterName,
                  })}
            </span>
            {relationship === undefined ? null : (
              <span>{t("bookStates", { count: relationship.bookStates.length })}</span>
            )}
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
