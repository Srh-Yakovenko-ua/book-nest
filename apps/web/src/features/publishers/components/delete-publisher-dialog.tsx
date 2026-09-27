"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

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
import { useRouter } from "@/i18n/navigation";
import { ApiError } from "@/lib/http-client";

import { useDeletePublisher } from "../api/use-delete-publisher";

const LINKED_BOOKS_STATUS = 409;

type DeleteOutcome = "failed" | "idle" | "linkedBooks";

type DeletePublisherDialogProps = {
  booksCount: number;
  onCloseAutoFocus: (event: Event) => void;
  onGoToBooks: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  publisherId: string;
  publisherName: string;
};

export function DeletePublisherDialog({
  booksCount,
  onCloseAutoFocus,
  onGoToBooks,
  onOpenChange,
  open,
  publisherId,
  publisherName,
}: DeletePublisherDialogProps) {
  const tToast = useTranslations("publishers.details.toast");
  const router = useRouter();
  const deletePublisher = useDeletePublisher(publisherId);
  const [outcome, setOutcome] = useState<DeleteOutcome>("idle");
  const blocked = booksCount > 0 || outcome === "linkedBooks";

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (deletePublisher.isPending) return;
        if (!next) setOutcome("idle");
        onOpenChange(next);
      }}
      open={open}
    >
      <AlertDialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
        onCloseAutoFocus={onCloseAutoFocus}
        size="sm"
      >
        {blocked ? (
          <BlockedDeleteContent
            onGoToBooks={() => {
              setOutcome("idle");
              onOpenChange(false);
              onGoToBooks();
            }}
            publisherName={publisherName}
          />
        ) : (
          <ConfirmDeleteContent
            failed={outcome === "failed"}
            onConfirm={() => {
              setOutcome("idle");
              deletePublisher.mutate(undefined, {
                onError: (error) => {
                  const linkedBooks =
                    error instanceof ApiError && error.status === LINKED_BOOKS_STATUS;
                  setOutcome(linkedBooks ? "linkedBooks" : "failed");
                },
                onSuccess: () => {
                  toast.success(tToast("deleted"));
                  onOpenChange(false);
                  router.replace("/publishers");
                },
              });
            }}
            pending={deletePublisher.isPending}
            publisherName={publisherName}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BlockedDeleteContent({
  onGoToBooks,
  publisherName,
}: {
  onGoToBooks: () => void;
  publisherName: string;
}) {
  const t = useTranslations("publishers.details.deleteDialog");

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogMedia>
          <UiIcon name="info" size={24} />
        </AlertDialogMedia>
        <AlertDialogTitle>{t("blockedTitle")}</AlertDialogTitle>
        <AlertDialogDescription>
          {t("blockedDescription", { name: publisherName })}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{t("close")}</AlertDialogCancel>
        <AlertDialogAction onClick={onGoToBooks}>{t("goToBooks")}</AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

function ConfirmDeleteContent({
  failed,
  onConfirm,
  pending,
  publisherName,
}: {
  failed: boolean;
  onConfirm: () => void;
  pending: boolean;
  publisherName: string;
}) {
  const t = useTranslations("publishers.details.deleteDialog");

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogMedia>
          <UiIcon name="alert-triangle" size={24} />
        </AlertDialogMedia>
        <AlertDialogTitle>{t("title")}</AlertDialogTitle>
        <AlertDialogDescription>{t("description", { name: publisherName })}</AlertDialogDescription>
      </AlertDialogHeader>
      {failed ? (
        <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error" role="alert">
          {t("genericError")}
        </p>
      ) : null}
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{t("cancel")}</AlertDialogCancel>
        <AlertDialogAction
          disabled={pending}
          onClick={(event) => {
            event.preventDefault();
            onConfirm();
          }}
          variant="destructive"
        >
          {pending ? t("deleting") : t("confirm")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
