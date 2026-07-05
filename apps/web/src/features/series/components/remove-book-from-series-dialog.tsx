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

type RemoveBookFromSeriesDialogProps = {
  isRemoving: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function RemoveBookFromSeriesDialog({
  isRemoving,
  onConfirm,
  onOpenChange,
  open,
}: RemoveBookFromSeriesDialogProps) {
  const t = useTranslations("series.removeBookDialog");

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="x-circle" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("body")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isRemoving}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
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
