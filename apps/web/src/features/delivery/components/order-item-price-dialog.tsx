"use client";

import type { FormEvent } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBook } from "@/features/books/api/use-book";
import { useUpdateDelivery } from "@/features/books/api/use-delivery";
import { useDeliveryErrorText } from "@/features/books/hooks/use-delivery-error-text";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import { DeliveryLoadingDialog } from "./delivery-loading-dialog";

const PRICE_MAX = 99999999.99;
const PRICE_INPUT_ID = "order-item-price";

type OrderItemPriceDialogProps = {
  bookId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

export function OrderItemPriceDialog({ bookId, onOpenChange, open }: OrderItemPriceDialogProps) {
  const t = useTranslations("delivery.priceDialog");
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
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { title: book.title })}</DialogDescription>
        </DialogHeader>
        <PriceForm
          bookId={bookId}
          currency={active.currency}
          deliveryId={active.id}
          onDone={() => onOpenChange(false)}
          price={active.price}
        />
      </DialogContent>
    </Dialog>
  );
}

function PriceForm({
  bookId,
  currency,
  deliveryId,
  onDone,
  price,
}: {
  bookId: string;
  currency: null | string;
  deliveryId: string;
  onDone: () => void;
  price: null | number;
}) {
  const t = useTranslations("delivery.priceDialog");
  const tErrors = useTranslations("books.details.delivery.errors");
  const deliveryErrorText = useDeliveryErrorText();
  const mutation = useUpdateDelivery();
  const [value, setValue] = useState(price === null ? "" : String(price));
  const [error, setError] = useState<null | string>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    const amount = Number(trimmed);

    if (trimmed.length > 0 && (!Number.isFinite(amount) || amount <= 0)) {
      setError(tErrors("price"));
      return;
    }
    if (amount > PRICE_MAX) {
      setError(tErrors("priceMax"));
      return;
    }

    setError(null);
    mutation.mutate(
      { deliveryId, id: bookId, payload: { price: trimmed.length === 0 ? null : amount } },
      { onError: (mutationError) => setError(deliveryErrorText(mutationError)), onSuccess: onDone },
    );
  }

  return (
    <form className="grid gap-4" noValidate onSubmit={submit}>
      <div className="grid gap-2">
        <Label htmlFor={PRICE_INPUT_ID}>{t("price")}</Label>
        <div className="flex items-center gap-2">
          <Input
            id={PRICE_INPUT_ID}
            inputMode="decimal"
            min="0"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={blockNegativeNumberKeys}
            onPaste={blockNegativeNumberPaste}
            step="0.01"
            type="number"
            value={value}
          />
          {currency === null ? null : (
            <span className="text-sm text-muted-foreground">{currency}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
        {error === null ? null : (
          <p className="text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      <DialogFooter>
        <Button disabled={mutation.isPending} onClick={onDone} type="button" variant="outline">
          {t("cancel")}
        </Button>
        <Button loading={mutation.isPending} type="submit">
          {t("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
