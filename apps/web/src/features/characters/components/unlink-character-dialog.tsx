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

type UnlinkCharacterDialogProps = {
  isUnlinking: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function UnlinkCharacterDialog({
  isUnlinking,
  onConfirm,
  onOpenChange,
  open,
}: UnlinkCharacterDialogProps) {
  const t = useTranslations("characters.unlink");

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="link" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isUnlinking}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isUnlinking}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {isUnlinking ? t("unlinking") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
