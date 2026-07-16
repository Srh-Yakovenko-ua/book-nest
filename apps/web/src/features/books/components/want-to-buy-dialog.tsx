"use client";

import type { BookView, Currency, WantToBuyInput } from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
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
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { ApiError } from "@/lib/http-client";
import { isHttpsUrl } from "@/lib/is-https-url";

import { useWantToBuy } from "../api/use-ownership";

const CURRENCY_OPTIONS = ["UAH", "EUR", "USD"] as const satisfies readonly Currency[];
const STORE_NAME_MAX = 100;
const STORE_URL_MAX = 300;
const NOTE_MAX = 300;
const PRICE_MIN = 0;
const PRICE_MAX = 99999999.99;

type WantToBuyBook = Pick<BookView, "id">;

type WantToBuyDialogProps = {
  book: WantToBuyBook;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type WantToBuyMessages = {
  noteMax: string;
  price: string;
  priceMax: string;
  storeNameMax: string;
  storeUrl: string;
  storeUrlMax: string;
};

type WantToBuyValues = {
  currency: "" | Currency;
  expectedPrice: string;
  note: string;
  storeName: string;
  storeUrl: string;
};

export function WantToBuyDialog({ book, onOpenChange, open }: WantToBuyDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {open ? <WantToBuyForm book={book} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function buildPayload(values: WantToBuyValues): WantToBuyInput {
  const payload: WantToBuyInput = {};
  const storeName = values.storeName.trim();
  const storeUrl = values.storeUrl.trim();
  const price = Number(values.expectedPrice);
  const note = values.note.trim();

  if (storeName.length > 0) payload.storeName = storeName;
  if (storeUrl.length > 0) payload.storeUrl = storeUrl;
  if (values.expectedPrice.trim().length > 0 && Number.isFinite(price))
    payload.expectedPrice = price;
  if (values.currency !== "") payload.currency = values.currency;
  if (note.length > 0) payload.note = note;

  return payload;
}

function buildSchema(messages: WantToBuyMessages) {
  return z.object({
    currency: z.enum(["", "UAH", "EUR", "USD"]),
    expectedPrice: z
      .string()
      .refine((value) => value.trim().length === 0 || Number(value) > PRICE_MIN, messages.price)
      .refine(
        (value) => value.trim().length === 0 || Number(value) <= PRICE_MAX,
        messages.priceMax,
      ),
    note: z.string().max(NOTE_MAX, messages.noteMax),
    storeName: z.string().max(STORE_NAME_MAX, messages.storeNameMax),
    storeUrl: z
      .string()
      .refine((value) => value.trim().length === 0 || isHttpsUrl(value.trim()), messages.storeUrl)
      .refine((value) => value.trim().length <= STORE_URL_MAX, messages.storeUrlMax),
  });
}

function WantToBuyForm({ book, onDone }: { book: WantToBuyBook; onDone: () => void }) {
  const t = useTranslations("books.details.ownership.buyDialog");
  const tErrors = useTranslations("books.details.ownership.errors");
  const tActions = useTranslations("books.actions");
  const wantToBuy = useWantToBuy();
  const [serverError, setServerError] = useState<null | string>(null);

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<WantToBuyValues>({
    defaultValues: { currency: "", expectedPrice: "", note: "", storeName: "", storeUrl: "" },
    mode: "onTouched",
    resolver: zodResolver(
      buildSchema({
        noteMax: tErrors("noteMax", { max: NOTE_MAX }),
        price: tErrors("price"),
        priceMax: tErrors("priceMax"),
        storeNameMax: tErrors("storeNameMax", { max: STORE_NAME_MAX }),
        storeUrl: tErrors("storeUrl"),
        storeUrlMax: tErrors("storeUrlMax", { max: STORE_URL_MAX }),
      }),
    ),
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    wantToBuy.mutate(
      { id: book.id, payload: buildPayload(values) },
      {
        onError: (error) =>
          setServerError(error instanceof ApiError ? error.message : tErrors("generic")),
        onSuccess: onDone,
      },
    );
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="buy-store-name">{t("storeName")}</Label>
        <Input
          aria-describedby={errors.storeName ? "buy-store-name-error" : undefined}
          aria-invalid={errors.storeName !== undefined}
          autoComplete="off"
          className="h-10"
          id="buy-store-name"
          placeholder={t("storeNamePlaceholder")}
          {...register("storeName")}
        />
        <FieldError error={errors.storeName} id="buy-store-name-error" />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="buy-store-url">{t("storeUrl")}</Label>
        <Input
          aria-describedby={errors.storeUrl ? "buy-store-url-error" : undefined}
          aria-invalid={errors.storeUrl !== undefined}
          autoComplete="off"
          className="h-10"
          id="buy-store-url"
          inputMode="url"
          placeholder={t("storeUrlPlaceholder")}
          {...register("storeUrl")}
        />
        <FieldError error={errors.storeUrl} id="buy-store-url-error" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="buy-expected-price">{t("expectedPrice")}</Label>
          <Input
            aria-describedby={errors.expectedPrice ? "buy-expected-price-error" : undefined}
            aria-invalid={errors.expectedPrice !== undefined}
            className="h-10"
            id="buy-expected-price"
            inputMode="decimal"
            min={0}
            onKeyDown={blockNegativeNumberKeys}
            onPaste={blockNegativeNumberPaste}
            placeholder="0"
            step="0.01"
            type="number"
            {...register("expectedPrice")}
          />
          <FieldError error={errors.expectedPrice} id="buy-expected-price-error" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="buy-currency">{t("currency")}</Label>
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <div className="w-full sm:w-28">
                <Select
                  onValueChange={field.onChange}
                  value={field.value === "" ? undefined : field.value}
                >
                  <SelectTrigger
                    className="h-10 w-full data-[size=default]:h-10"
                    id="buy-currency"
                    isClearable={field.value !== ""}
                    onClear={() => field.onChange("")}
                  >
                    <SelectValue placeholder={t("currencyPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="buy-note">{t("note")}</Label>
        <Controller
          control={control}
          name="note"
          render={({ field }) => (
            <>
              <Textarea
                aria-describedby={
                  errors.note ? "buy-note-error buy-note-counter" : "buy-note-counter"
                }
                aria-invalid={errors.note !== undefined}
                id="buy-note"
                maxLength={NOTE_MAX}
                onChange={field.onChange}
                placeholder={t("notePlaceholder")}
                value={field.value}
              />
              <div className="flex items-center justify-between gap-2">
                <FieldError error={errors.note} id="buy-note-error" />
                <span
                  className="ml-auto text-xs text-muted-foreground tabular-nums"
                  id="buy-note-counter"
                >
                  {field.value.length}/{NOTE_MAX}
                </span>
              </div>
            </>
          )}
        />
      </div>

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={wantToBuy.isPending} loading={wantToBuy.isPending} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
