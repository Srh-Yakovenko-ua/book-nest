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

type SeriesOrderDisableDialogProps = {
  isPending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  series: null | { id: string; title: string };
};

export function SeriesOrderDisableDialog({
  isPending,
  onConfirm,
  onOpenChange,
  series,
}: SeriesOrderDisableDialogProps) {
  const t = useTranslations("readingQueue.seriesOrderCheck.disable");

  return (
    <AlertDialog onOpenChange={(open) => !isPending && onOpenChange(open)} open={series !== null}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="circle-slash" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            variant="destructive"
          >
            {t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
