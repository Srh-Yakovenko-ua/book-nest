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

type DeletePublisherDialogProps = {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  publisherId: string;
  publisherName: string;
};

export function DeletePublisherDialog({
  onOpenChange,
  open,
  publisherId,
  publisherName,
}: DeletePublisherDialogProps) {
  const t = useTranslations("publishers.details.deleteDialog");
  const tToast = useTranslations("publishers.details.toast");
  const router = useRouter();
  const deletePublisher = useDeletePublisher(publisherId);
  const [error, setError] = useState<null | string>(null);

  function onConfirm() {
    setError(null);
    deletePublisher.mutate(undefined, {
      onError: (mutationError) => {
        if (mutationError instanceof ApiError && mutationError.status === LINKED_BOOKS_STATUS) {
          setError(t("linkedBooksError"));
          return;
        }
        setError(t("genericError"));
      },
      onSuccess: () => {
        toast.success(tToast("deleted"));
        onOpenChange(false);
        router.push("/publishers");
      },
    });
  }

  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (deletePublisher.isPending) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
      open={open}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <UiIcon name="alert-triangle" size={24} />
          </AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("description", { name: publisherName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error === null ? null : (
          <p className="rounded-md bg-error-soft px-3 py-2 text-sm text-error" role="alert">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletePublisher.isPending}>{t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            disabled={deletePublisher.isPending}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            variant="destructive"
          >
            {deletePublisher.isPending ? t("deleting") : t("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
