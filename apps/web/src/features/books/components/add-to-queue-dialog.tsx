"use client";

import type { BookView } from "@app/shared";
import type { FormEvent } from "react";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";

import {
  useAddToReadingQueue,
  useReadingQueue,
  useRemoveFromQueue,
  useReorderReadingQueue,
} from "../api/use-reading-queue";
import { toQueuePickerItems } from "../model/queue-placement";
import { useAddToQueueForm } from "../model/use-add-to-queue-form";
import { QueueBookPreview } from "./queue-book-preview";
import { QueuePositionField } from "./queue-position-field";

type AddToQueueDialogContext = "detail" | "list";

type AddToQueueDialogProps = {
  book: BookView;
  context?: AddToQueueDialogContext;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function AddToQueueDialog({
  book,
  context = "list",
  onOpenChange,
  open,
}: AddToQueueDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <AddToQueueForm book={book} context={context} onDone={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddToQueueForm({
  book,
  context,
  onDone,
}: {
  book: BookView;
  context: AddToQueueDialogContext;
  onDone: () => void;
}) {
  const t = useTranslations("books.details.queue.addDialog");
  const tAdd = useTranslations("readingQueue.add");
  const tQueue = useTranslations("readingQueue");
  const queue = useReadingQueue();
  const queueItems = toQueuePickerItems(queue.data?.items ?? []);
  const count = queue.data?.count ?? 0;

  const currentPosition = queueItems.find((item) => item.id === book.id)?.position ?? null;
  const form = useAddToQueueForm({
    currentBookId: currentPosition === null ? undefined : book.id,
    queueItems,
  });

  const add = useAddToReadingQueue();
  const reorder = useReorderReadingQueue();
  const remove = useRemoveFromQueue();
  const isMove = form.mode === "move";
  const isBusy = queue.isPending || add.isPending || reorder.isPending || remove.isPending;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isMove) return submitMove();
    submitAdd();
  }

  function submitAdd() {
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

  function submitMove() {
    const order = form.buildOrder();
    if (order === null) return;
    reorder.mutate(order, {
      onError: () => toast.error(tQueue("reorder.error")),
      onSuccess: () => {
        toast.success(t("moveToast"));
        onDone();
      },
    });
  }

  function onRemove() {
    remove.mutate(book.id, {
      onError: () => toast.error(tQueue("remove.error")),
      onSuccess: () => {
        toast.success(tQueue("remove.toast"));
        onDone();
      },
    });
  }

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{isMove ? t("moveTitle") : t("title")}</DialogTitle>
        <DialogDescription>{isMove ? t("moveSubtitle") : t("subtitle")}</DialogDescription>
      </DialogHeader>

      <p className="text-sm text-muted-foreground">
        {count > 0 ? t("queueState", { count }) : t("queueEmpty")}
      </p>

      {isMove && currentPosition !== null ? (
        <p className="rounded-lg bg-secondary/50 px-3 py-2 text-sm text-foreground">
          {t("alreadyInQueue", { position: currentPosition })}
        </p>
      ) : null}

      {context === "list" ? <QueueBookPreview book={book} /> : null}

      <QueuePositionField
        candidates={form.relativeCandidates}
        disabled={queue.isPending}
        error={form.error}
        idPrefix="details-add-queue-position"
        maxPosition={form.maxPosition}
        onPlacementChange={form.setPlacement}
        onPositionChange={form.setPosition}
        onRelativeBookChange={form.setRelativeBookId}
        onRelativeSideChange={form.setRelativeSide}
        outcome={form.outcome}
        placement={form.placement}
        position={form.position}
        queueLength={form.queueLength}
        relativeBookId={form.relativeBookId}
        relativeSide={form.relativeSide}
      />

      {count > 0 ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <UiIcon className="mt-0.5 shrink-0" name="info" size={14} />
          <span>
            {t.rich("reorderHint", {
              link: (chunks) => (
                <Link
                  className="text-primary underline-offset-2 hover:underline"
                  href="/reading-queue"
                  rel="noopener"
                  target="_blank"
                >
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </p>
      ) : null}

      <DialogFooter>
        {isMove ? (
          <Button
            className="sm:mr-auto"
            disabled={isBusy}
            onClick={onRemove}
            type="button"
            variant="destructive"
          >
            <UiIcon name="x-circle" size={16} />
            {tQueue("item.remove")}
          </Button>
        ) : null}
        <Button disabled={isBusy} onClick={onDone} type="button" variant="secondary">
          {tAdd("cancel")}
        </Button>
        <Button disabled={isBusy || !form.isValid} loading={isBusy} type="submit">
          {submitLabel()}
        </Button>
      </DialogFooter>
    </form>
  );

  function submitLabel(): string {
    if (isMove) return reorder.isPending ? t("moving") : t("move");
    return add.isPending ? tAdd("submitting") : tAdd("submit");
  }
}
