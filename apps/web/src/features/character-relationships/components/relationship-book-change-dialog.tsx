"use client";

import { useTranslations } from "next-intl";

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

type RelationshipBookChangeDialogProps = {
  onCancel: () => void;
  onCloseAutoFocus: (event: Event) => void;
  onConfirm: () => void;
  open: boolean;
};

export function RelationshipBookChangeDialog({
  onCancel,
  onCloseAutoFocus,
  onConfirm,
  open,
}: RelationshipBookChangeDialogProps) {
  const t = useTranslations("relationships.editor.book.changeConfirm");

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      open={open}
    >
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus} size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="book" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>{t("confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
