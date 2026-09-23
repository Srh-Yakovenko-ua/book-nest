"use client";

import type { Nullable, TagCatalogListItem, TagDeletionPreviewView } from "@app/shared";

import { useTranslations } from "next-intl";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useDeleteTag } from "../api/use-delete-tag";
import { useTagDeletionPreview } from "../api/use-tag-deletion-preview";

type DeleteTagDialogProps = {
  onOpenChange: (open: boolean) => void;
  tag: Nullable<TagCatalogListItem>;
};

export function DeleteTagDialog({ onOpenChange, tag }: DeleteTagDialogProps) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={tag !== null}>
      <AlertDialogContent size="sm">
        {tag === null ? null : (
          <DeleteTagContent
            key={tag.id}
            onDone={() => onOpenChange(false)}
            tagId={tag.id}
            tagName={tag.name}
          />
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

function DeleteTagContent({
  onDone,
  tagId,
  tagName,
}: {
  onDone: () => void;
  tagId: string;
  tagName: string;
}) {
  const t = useTranslations("tags.deleteDialog");
  const preview = useTagDeletionPreview(tagId);
  const deleteTag = useDeleteTag();
  const canConfirm = preview.isSuccess && !preview.isFetching && !deleteTag.isPending;

  function confirm() {
    if (!canConfirm) return;
    deleteTag.mutate(tagId, {
      onSuccess: () => {
        toast.success(t("success"));
        onDone();
      },
    });
  }

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogMedia>
          <UiIcon name="alert-triangle" size={24} />
        </AlertDialogMedia>
        <AlertDialogTitle>{t("title", { name: tagName })}</AlertDialogTitle>
        <AlertDialogDescription>{t("description")}</AlertDialogDescription>
      </AlertDialogHeader>

      <DeletionImpact
        isError={preview.isError}
        isRetrying={preview.isFetching}
        onRetry={() => void preview.refetch()}
        preview={preview.data}
      />

      {deleteTag.isError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {t("failed")}
        </p>
      ) : null}

      <AlertDialogFooter>
        <AlertDialogCancel disabled={deleteTag.isPending}>{t("cancel")}</AlertDialogCancel>
        <AlertDialogAction
          disabled={!canConfirm}
          onClick={(event) => {
            event.preventDefault();
            confirm();
          }}
          variant="destructive"
        >
          {deleteTag.isPending ? t("deleting") : t("confirm")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}

function DeletionImpact({
  isError,
  isRetrying,
  onRetry,
  preview,
}: {
  isError: boolean;
  isRetrying: boolean;
  onRetry: () => void;
  preview: TagDeletionPreviewView | undefined;
}) {
  const t = useTranslations("tags.deleteDialog");

  if (isError) {
    return (
      <div
        className="flex flex-col items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        role="alert"
      >
        <p>{t("previewError")}</p>
        <Button
          disabled={isRetrying}
          loading={isRetrying}
          onClick={onRetry}
          size="sm"
          type="button"
          variant="secondary"
        >
          <UiIcon name="refresh" size={14} />
          {t("previewRetry")}
        </Button>
      </div>
    );
  }

  if (preview === undefined) {
    return (
      <div aria-busy className="flex flex-col gap-2" role="status">
        <span className="sr-only">{t("previewLoading")}</span>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  const hasLinks = preview.bookLinksCount > 0 || preview.characterLinksCount > 0;

  return (
    <ul className="flex flex-col gap-1.5 rounded-md bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
      {hasLinks ? null : <li>{t("noLinks")}</li>}
      {preview.bookLinksCount > 0 ? (
        <li>{t("bookLinks", { count: preview.bookLinksCount })}</li>
      ) : null}
      {preview.characterLinksCount > 0 ? (
        <li>{t("characterLinks", { count: preview.characterLinksCount })}</li>
      ) : null}
      <li>{t("booksRemain")}</li>
      <li>{t("charactersRemain")}</li>
      <li className="font-medium text-foreground">{t("irreversible")}</li>
    </ul>
  );
}
