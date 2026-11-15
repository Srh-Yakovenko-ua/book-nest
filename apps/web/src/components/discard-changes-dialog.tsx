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

type DiscardChangesDialogProps = {
  cancelLabel?: string;
  confirmLabel?: string;
  description?: string;
  onCloseAutoFocus?: (event: Event) => void;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title?: string;
};

export function DiscardChangesDialog({
  cancelLabel,
  confirmLabel,
  description,
  onCloseAutoFocus,
  onConfirm,
  onOpenChange,
  open,
  title,
}: DiscardChangesDialogProps) {
  const t = useTranslations("common.discardChanges");

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent
        className="w-[calc(100%-2rem)] data-[size=sm]:sm:max-w-md"
        onCloseAutoFocus={onCloseAutoFocus}
        size="sm"
      >
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="alert-triangle" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{title ?? t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{description ?? t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col group-data-[size=sm]/alert-dialog-content:flex">
          <AlertDialogCancel>{cancelLabel ?? t("cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} variant="destructive">
            {confirmLabel ?? t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
