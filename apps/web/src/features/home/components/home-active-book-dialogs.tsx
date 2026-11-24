"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChangeReadingStatusDialog, UpdateReadingProgressDialog } from "@/features/books";
import { assertNever } from "@/lib/assert-never";

import type { HomeActiveBookDialog } from "../model/home-active-book-dialog";

type HomeActiveBookDialogsProps = {
  book: BookView | undefined;
  dialog: HomeActiveBookDialog;
  isError: boolean;
  isRetrying: boolean;
  onClose: () => void;
  onRetry: () => void;
};

export function HomeActiveBookDialogs({
  book,
  dialog,
  isError,
  isRetrying,
  onClose,
  onRetry,
}: HomeActiveBookDialogsProps) {
  const t = useTranslations("home.reading.dialog");

  if (dialog.kind === "closed") return null;

  const closeWhenDismissed = (open: boolean) => {
    if (!open) onClose();
  };

  if (book === undefined) {
    if (!isError) return null;
    return (
      <Dialog onOpenChange={closeWhenDismissed} open>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("errorTitle")}</DialogTitle>
            <DialogDescription>{t("errorDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="secondary">
              {t("close")}
            </Button>
            <Button loading={isRetrying} onClick={onRetry} type="button">
              {t("retry")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  switch (dialog.kind) {
    case "progress":
      return <UpdateReadingProgressDialog book={book} onOpenChange={closeWhenDismissed} open />;
    case "status":
      return (
        <ChangeReadingStatusDialog
          book={book}
          defaultStatus={dialog.status}
          onOpenChange={closeWhenDismissed}
          open
        />
      );
    default:
      return assertNever(dialog);
  }
}
