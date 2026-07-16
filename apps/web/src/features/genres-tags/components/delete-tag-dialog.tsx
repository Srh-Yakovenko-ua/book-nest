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

import type { TagCardItem } from "../model/tags-derive";

type DeleteTagDialogProps = {
  isDeleting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  tag: null | TagCardItem;
};

export function DeleteTagDialog({
  isDeleting,
  onConfirm,
  onOpenChange,
  tag,
}: DeleteTagDialogProps) {
  const t = useTranslations("genresTags.deleteDialog");
  const isUsed = (tag?.booksCount ?? 0) > 0;

  return (
    <AlertDialog onOpenChange={onOpenChange} open={tag !== null}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="alert-triangle" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {isUsed ? t("bodyUsed") : t("bodyUnused")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {tag !== null && isUsed ? (
          <p className="rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
            {t("booksCount", { count: tag.booksCount })}
          </p>
        ) : null}
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
