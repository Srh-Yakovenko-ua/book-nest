"use client";

import type { BookView, Currency, MarkBoughtInput } from "@app/shared";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { ApiError } from "@/lib/http-client";

import { useMarkBought } from "../api/use-ownership";
import { todayIso } from "../model/reading-progress";
import { BookDateField } from "./book-date-field";
import { StoreAutocomplete } from "./store-autocomplete";

const CURRENCY_OPTIONS = ["UAH", "EUR", "USD"] as const satisfies readonly Currency[];
const DEFAULT_CURRENCY: Currency = "UAH";
const STORE_NAME_MAX = 100;
const PRICE_MIN = 0;
const PRICE_MAX = 99999999.99;

type MarkBoughtDialogProps = {
  book: BookView;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

type MarkBoughtMessages = {
  dateFuture: string;
  dateRequired: string;
  price: string;
  priceMax: string;
  storeNameMax: string;
};

type MarkBoughtValues = {
  currency: Currency;
  expectedPrice: string;
  purchasedAt: string;
  source: "other" | "plan";
  storeName: string;
};

export function MarkBoughtDialog({ book, onOpenChange, open }: MarkBoughtDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        {open ? <MarkBoughtForm book={book} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function buildPayload(values: MarkBoughtValues, usesOther: boolean): MarkBoughtInput {
  const payload: MarkBoughtInput = { purchasedAt: values.purchasedAt };
  if (!usesOther) return payload;

  const storeName = values.storeName.trim();
  const price = Number(values.expectedPrice);

  if (storeName.length > 0) payload.storeName = storeName;
  if (values.expectedPrice.trim().length > 0 && Number.isFinite(price))
    payload.expectedPrice = price;
  payload.currency = values.currency;

  return payload;
}

function buildSchema(messages: MarkBoughtMessages) {
  return z.object({
    currency: z.enum(CURRENCY_OPTIONS),
    expectedPrice: z
      .string()
      .refine((value) => value.trim().length === 0 || Number(value) > PRICE_MIN, messages.price)
      .refine(
        (value) => value.trim().length === 0 || Number(value) <= PRICE_MAX,
        messages.priceMax,
      ),
    purchasedAt: z
      .string()
      .refine((value) => value.length > 0, messages.dateRequired)
      .refine((value) => value.length === 0 || value <= todayIso(), messages.dateFuture),
    source: z.enum(["plan", "other"]),
    storeName: z.string().max(STORE_NAME_MAX, messages.storeNameMax),
  });
}

function formatPrice(price: number, currency: Currency, locale: string): string {
  return `${new Intl.NumberFormat(locale).format(price)} ${currency}`;
}

function MarkBoughtForm({ book, onDone }: { book: BookView; onDone: () => void }) {
  const t = useTranslations("books.details.ownership.buyConfirm");
  const tDialog = useTranslations("books.details.ownership.buyDialog");
  const tErrors = useTranslations("books.details.ownership.errors");
  const tActions = useTranslations("books.actions");
  const locale = useLocale();
  const markBought = useMarkBought();
  const [serverError, setServerError] = useState<null | string>(null);

  const planStore = book.purchaseInfo?.storeName ?? null;
  const hasPlanStore = planStore !== null && planStore.trim().length > 0;
  const planPrice = book.purchaseInfo?.expectedPrice ?? null;
  const planCurrency = book.purchaseInfo?.currency ?? DEFAULT_CURRENCY;
  const planLabel =
    planStore !== null && planPrice !== null
      ? `${planStore} — ${formatPrice(planPrice, planCurrency, locale)}`
      : (planStore ?? "");

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<MarkBoughtValues>({
    defaultValues: {
      currency: DEFAULT_CURRENCY,
      expectedPrice: "",
      purchasedAt: todayIso(),
      source: hasPlanStore ? "plan" : "other",
      storeName: "",
    },
    mode: "onTouched",
    resolver: zodResolver(
      buildSchema({
        dateFuture: tErrors("purchaseDateFuture"),
        dateRequired: tErrors("purchaseDateRequired"),
        price: tErrors("price"),
        priceMax: tErrors("priceMax"),
        storeNameMax: tErrors("storeNameMax", { max: STORE_NAME_MAX }),
      }),
    ),
  });

  const source = useWatch({ control, name: "source" });
  const usesOther = !hasPlanStore || source === "other";

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    markBought.mutate(
      { id: book.id, payload: buildPayload(values, usesOther) },
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

      {hasPlanStore ? (
        <Controller
          control={control}
          name="source"
          render={({ field }) => (
            <RadioGroup onValueChange={field.onChange} value={field.value}>
              <label
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:border-accent-border"
                htmlFor="buy-source-plan"
              >
                <RadioGroupItem className="mt-0.5" id="buy-source-plan" value="plan" />
                <span className="min-w-0 text-sm text-foreground">{planLabel}</span>
              </label>
              <label
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card p-3 transition-colors hover:border-accent-border"
                htmlFor="buy-source-other"
              >
                <RadioGroupItem className="mt-0.5" id="buy-source-other" value="other" />
                <span className="min-w-0 text-sm text-foreground">{t("sourceOther")}</span>
              </label>
            </RadioGroup>
          )}
        />
      ) : null}

      {usesOther ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="buy-store-name">{tDialog("storeName")}</Label>
            <Controller
              control={control}
              name="storeName"
              render={({ field }) => (
                <StoreAutocomplete
                  describedBy={errors.storeName ? "buy-store-name-error" : undefined}
                  id="buy-store-name"
                  invalid={errors.storeName !== undefined}
                  label={tDialog("storeName")}
                  onChange={field.onChange}
                  placeholder={tDialog("storeNamePlaceholder")}
                  value={field.value}
                />
              )}
            />
            <FieldError error={errors.storeName} id="buy-store-name-error" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="buy-expected-price">{t("price")}</Label>
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
              <Label htmlFor="buy-currency">{tDialog("currency")}</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <div className="w-full sm:w-28">
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger
                        className="h-10 w-full data-[size=default]:h-10"
                        id="buy-currency"
                      >
                        <SelectValue placeholder={tDialog("currencyPlaceholder")} />
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
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="buy-purchased-at">{t("date")}</Label>
        <Controller
          control={control}
          name="purchasedAt"
          render={({ field }) => (
            <BookDateField
              ariaLabel={t("date")}
              describedBy={errors.purchasedAt ? "buy-purchased-at-error" : undefined}
              id="buy-purchased-at"
              invalid={errors.purchasedAt !== undefined}
              onChange={(next) => field.onChange(next ?? "")}
              value={field.value}
            />
          )}
        />
        <FieldError error={errors.purchasedAt} id="buy-purchased-at-error" />
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
        <Button disabled={markBought.isPending} loading={markBought.isPending} type="submit">
          {t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
