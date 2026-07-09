"use client";

import type { BookView, QueuePriority } from "@app/shared";

import { QueuePrioritySchema } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { queuePriorities } from "@/lib/book-status";

import { useChangeQueuePriority } from "../api/use-book-actions";
import { useReadingQueuePosition } from "../api/use-reading-queue";
import { QueueBookPreview } from "./queue-book-preview";

type ChangeQueuePriorityDialogProps = {
  book: BookView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function ChangeQueuePriorityDialog({
  book,
  onOpenChange,
  open,
}: ChangeQueuePriorityDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {open ? <ChangePriorityForm book={book} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ChangePriorityForm({ book, onDone }: { book: BookView; onDone: () => void }) {
  const t = useTranslations("books.details.queue");
  const tPriority = useTranslations("books.organization.priorityLabels");
  const tActions = useTranslations("books.actions");
  const change = useChangeQueuePriority();
  const position = useReadingQueuePosition(book);

  const currentPriority = book.queuePriority ?? "normal";

  const { control, handleSubmit } = useForm<{ queuePriority: QueuePriority }>({
    defaultValues: { queuePriority: currentPriority },
    resolver: zodResolver(z.object({ queuePriority: QueuePrioritySchema })),
  });

  const selected = useWatch({ control, name: "queuePriority" });
  const currentEntry = queuePriorities.find((entry) => entry.value === currentPriority);

  const onSubmit = handleSubmit((values) => {
    change.mutate(
      { id: book.id, queuePriority: values.queuePriority },
      {
        onError: () => toast.error(t("toast.priorityError")),
        onSuccess: () => {
          toast.success(t("toast.priorityUpdated"));
          onDone();
        },
      },
    );
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{t("priorityDialog.title")}</DialogTitle>
        <DialogDescription>{t("priorityDialog.description")}</DialogDescription>
      </DialogHeader>

      <QueueBookPreview book={book}>
        {position === null ? null : (
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("priorityDialog.positionLine", { position })}
          </span>
        )}
        {currentEntry === undefined ? null : (
          <StatusBadge entry={{ ...currentEntry, label: tPriority(currentPriority) }} />
        )}
      </QueueBookPreview>

      <div className="flex flex-col gap-2">
        <Label htmlFor="queue-priority">{t("priorityDialog.priorityLabel")}</Label>
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
        <Button
          disabled={selected === currentPriority || change.isPending}
          loading={change.isPending}
          type="submit"
        >
          {t("priorityDialog.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
