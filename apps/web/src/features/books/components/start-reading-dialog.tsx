"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { useStartReadingFromQueue } from "../api/use-reading-queue";

type StartReadingDialogProps = {
  book: null | StartReadingTarget;
  onOpenChange: (open: boolean) => void;
};

type StartReadingTarget = {
  id: string;
  title: string;
};

export function StartReadingDialog({ book, onOpenChange }: StartReadingDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={book !== null}>
      <DialogContent className="sm:max-w-md">
        {book ? <StartReadingForm book={book} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function StartReadingForm({ book, onDone }: { book: StartReadingTarget; onDone: () => void }) {
  const t = useTranslations("readingQueue.start");
  const start = useStartReadingFromQueue();
  const [removeFromQueue, setRemoveFromQueue] = useState(true);

  function onConfirm() {
    start.mutate(
      { bookId: book.id, removeFromQueue },
      {
        onError: () => toast.error(t("error")),
        onSuccess: () => {
          toast.success(t("successToast"));
          onDone();
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <label className="flex cursor-pointer items-center gap-2.5" htmlFor="start-remove-from-queue">
        <Checkbox
          checked={removeFromQueue}
          id="start-remove-from-queue"
          onCheckedChange={(checked) => setRemoveFromQueue(checked === true)}
        />
        <span className="text-sm text-foreground">{t("removeLabel")}</span>
      </label>

      <DialogFooter>
        <Button disabled={start.isPending} onClick={onDone} type="button" variant="secondary">
          {t("cancel")}
        </Button>
        <Button disabled={start.isPending} loading={start.isPending} onClick={onConfirm}>
          {start.isPending ? t("confirming") : t("confirm")}
        </Button>
      </DialogFooter>
    </div>
  );
}
