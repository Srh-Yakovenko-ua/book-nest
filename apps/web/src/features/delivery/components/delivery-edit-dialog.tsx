"use client";

import { useTranslations } from "next-intl";

import { useBook } from "@/features/books";
import { DeliveryDialog } from "@/features/books/components/delivery-dialog";

import { DeliveryLoadingDialog } from "./delivery-loading-dialog";

type DeliveryEditDialogProps = {
  bookId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function DeliveryEditDialog({ bookId, onOpenChange, open }: DeliveryEditDialogProps) {
  const t = useTranslations("books.details.delivery.editDialog");
  const tErrors = useTranslations("books.details.delivery.errors");
  const { data: book, isError } = useBook(bookId);

  const active = book?.delivery.active ?? null;

  if (book === undefined || active === null) {
    return (
      <DeliveryLoadingDialog
        description={t("description")}
        errorText={tErrors("generic")}
        isError={isError || (book !== undefined && active === null)}
        onOpenChange={onOpenChange}
        open={open}
        title={t("title")}
      />
    );
  }

  return (
    <DeliveryDialog
      book={book}
      delivery={active}
      mode="edit"
      onOpenChange={onOpenChange}
      open={open}
    />
  );
}
