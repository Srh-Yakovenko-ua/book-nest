"use client";

import type { BookView, QueuePriority } from "@app/shared";

import { QueuePrioritySchema } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { ownershipStatuses, readingStatuses } from "@/lib/book-status";
import { ApiError } from "@/lib/http-client";

import { useAddToReadingQueueWithPriority } from "../api/use-book-actions";
import { QueueBookPreview } from "./queue-book-preview";

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
  const t = useTranslations("books.details.queue");
  const tPriority = useTranslations("books.organization.priorityLabels");
  const tReading = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tActions = useTranslations("books.actions");
  const add = useAddToReadingQueueWithPriority();

  const { control, handleSubmit } = useForm<{ queuePriority: QueuePriority }>({
    defaultValues: { queuePriority: "normal" },
    resolver: zodResolver(z.object({ queuePriority: QueuePrioritySchema })),
  });

  const readingEntry = readingStatuses.find((entry) => entry.value === book.readingStatus);
  const ownershipEntry =
    book.ownershipStatus === "none"
      ? undefined
      : ownershipStatuses.find((entry) => entry.value === book.ownershipStatus);

  const onSubmit = handleSubmit((values) => {
    add.mutate(
      { id: book.id, queuePriority: values.queuePriority },
      {
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 409
              ? t("toast.duplicate")
              : t("toast.addError"),
          ),
        onSuccess: () => {
          toast.success(t("toast.added"));
          onDone();
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{t("addDialog.title")}</DialogTitle>
        <DialogDescription>{t("addDialog.description")}</DialogDescription>
      </DialogHeader>

      <QueueBookPreview book={book}>
        {readingEntry === undefined ? null : (
          <StatusBadge entry={{ ...readingEntry, label: tReading(book.readingStatus) }} />
        )}
        {ownershipEntry === undefined ? null : (
          <StatusBadge entry={{ ...ownershipEntry, label: tOwnership(book.ownershipStatus) }} />
        )}
      </QueueBookPreview>

      <div className="flex flex-col gap-2">
        <Label htmlFor="queue-priority">{t("addDialog.priorityLabel")}</Label>
        <Controller
          control={control}
          name="queuePriority"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger className="h-10 w-full data-[size=default]:h-10" id="queue-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QueuePrioritySchema.options.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {tPriority(priority)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={add.isPending} loading={add.isPending} type="submit">
          {t("addDialog.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
