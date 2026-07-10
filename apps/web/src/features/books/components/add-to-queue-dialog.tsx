"use client";

import type { BookView } from "@app/shared";
import type { FormEvent } from "react";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { ownershipStatuses, readingStatuses } from "@/lib/book-status";
import { ApiError } from "@/lib/http-client";

import { useAddToReadingQueue, useReadingQueue } from "../api/use-reading-queue";
import { useAddToQueueForm } from "../model/use-add-to-queue-form";
import { QueueBookPreview } from "./queue-book-preview";
import { QueuePositionField } from "./queue-position-field";

type AddToQueueDialogProps = {
  book: BookView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AddToQueueDialog({ book, onOpenChange, open }: AddToQueueDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {open ? <AddToQueueForm book={book} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function AddToQueueForm({ book, onDone }: { book: BookView; onDone: () => void }) {
  const t = useTranslations("books.details.queue.addDialog");
  const tAdd = useTranslations("readingQueue.add");
  const tReading = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const queue = useReadingQueue();
  const queueLength = queue.data?.count ?? 0;
  const form = useAddToQueueForm(queueLength);
  const add = useAddToReadingQueue();

  const readingEntry = readingStatuses.find((entry) => entry.value === book.readingStatus);
  const ownershipEntry =
    book.ownershipStatus === "none"
      ? undefined
      : ownershipStatuses.find((entry) => entry.value === book.ownershipStatus);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = form.buildInput(book.id);
    if (input === null) return;
    add.mutate(input, {
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          toast.error(tAdd("duplicateToast"));
          return;
        }
        toast.error(tAdd("errorToast"));
      },
      onSuccess: () => {
        toast.success(tAdd("successToast"));
        onDone();
      },
    });
  }

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("subtitle")}</DialogDescription>
      </DialogHeader>

      <QueueBookPreview book={book}>
        {readingEntry === undefined ? null : (
          <StatusBadge entry={{ ...readingEntry, label: tReading(book.readingStatus) }} />
        )}
        {ownershipEntry === undefined ? null : (
          <StatusBadge entry={{ ...ownershipEntry, label: tOwnership(book.ownershipStatus) }} />
        )}
      </QueueBookPreview>

      <QueuePositionField
        disabled={queue.isPending}
        error={form.error}
        idPrefix="details-add-queue-position"
        onPlacementChange={form.setPlacement}
        onPositionChange={form.setPosition}
        placement={form.placement}
        position={form.position}
        queueLength={queueLength}
      />

      <DialogFooter>
        <Button disabled={add.isPending} onClick={onDone} type="button" variant="secondary">
          {tAdd("cancel")}
        </Button>
        <Button
          disabled={add.isPending || queue.isPending}
          loading={add.isPending || queue.isPending}
          type="submit"
        >
          {add.isPending ? tAdd("submitting") : tAdd("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
