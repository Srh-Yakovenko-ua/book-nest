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
import { Skeleton } from "@/components/ui/skeleton";

import { useDeletionPreview } from "../api/use-deletion-preview";

type DeleteCharacterDialogProps = {
  characterId: null | string;
  isDeleting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function DeleteCharacterDialog({
  characterId,
  isDeleting,
  onConfirm,
  onOpenChange,
  open,
}: DeleteCharacterDialogProps) {
  const t = useTranslations("characters.delete");
  const preview = useDeletionPreview(characterId ?? "", open && characterId !== null);

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="alert-triangle" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2 rounded-lg bg-secondary/50 px-3 py-2.5 text-sm">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t("previewIntro")}
          </span>
          {preview.isPending ? (
            <Skeleton className="h-4 w-40" />
          ) : preview.data === undefined ? null : (
            <ul className="flex flex-col gap-1 text-foreground">
              <li>{t("appearances", { count: preview.data.appearanceCount })}</li>
              <li>{t("roles", { count: preview.data.roleCount })}</li>
              <li>{t("aliases", { count: preview.data.aliasCount })}</li>
              <li>{t("tags", { count: preview.data.tagCount })}</li>
            </ul>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isDeleting}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
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
