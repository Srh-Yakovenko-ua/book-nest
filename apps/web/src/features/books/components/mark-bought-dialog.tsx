"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useBookStoreLinks } from "@/features/books-to-buy";

import { MarkBoughtForm } from "./mark-bought-form";

type MarkBoughtDialogProps = {
  book: BookView;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  open: boolean;
};

export function MarkBoughtDialog({ book, onOpenChange, onSuccess, open }: MarkBoughtDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  return (
    <Dialog
      onOpenChange={(next) => {
        if (isSaving) return;
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        {open ? (
          <MarkBoughtContent
            book={book}
            onDone={() => onOpenChange(false)}
            onPendingChange={setIsSaving}
            onSuccess={onSuccess}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function MarkBoughtContent({
  book,
  onDone,
  onPendingChange,
  onSuccess,
}: {
  book: BookView;
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
  onSuccess?: () => void;
}) {
  const t = useTranslations("books.details.ownership.buyConfirm");
  const tErrors = useTranslations("books.details.ownership.errors");
  const storeLinksQuery = useBookStoreLinks(book.id);
  const { bestOffer, storeLinks } = storeLinksQuery.data ?? { bestOffer: null, storeLinks: [] };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      {storeLinksQuery.isError ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {tErrors("storeLinksUnavailable")}
        </p>
      ) : null}

      {storeLinksQuery.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <MarkBoughtForm
          bestOffer={bestOffer}
          book={book}
          onDone={onDone}
          onPendingChange={onPendingChange}
          onSuccess={onSuccess}
          storeLinks={storeLinks}
        />
      )}
    </>
  );
}
