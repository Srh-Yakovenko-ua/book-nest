"use client";

import { useTranslations } from "next-intl";

import { useBook } from "@/features/books";
import { CancelDeliveryDialog } from "@/features/books/components/cancel-delivery-dialog";

import { DeliveryLoadingDialog } from "./delivery-loading-dialog";

type DeliveryCancelDialogProps = {
  bookId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function DeliveryCancelDialog({ bookId, onOpenChange, open }: DeliveryCancelDialogProps) {
  const t = useTranslations("books.details.delivery.cancelDialog");
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
    <CancelDeliveryDialog book={book} delivery={active} onOpenChange={onOpenChange} open={open} />
  );
}
