"use client";

import type {
  BestOfferView,
  BookStoreLinkView,
  BookView,
  CreateDeliveryInput,
  Nullable,
} from "@app/shared";
import type { ReactNode } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { isAfter, isBefore, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogFooter } from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import {
  BookDateField,
  buildStoreSourceSchema,
  resolveStoreName,
  resolveStorePrice,
  STORE_SOURCE_LIMITS,
  StoreSourceFields,
  type StoreSourceValue,
  todayIso,
  toStoreSourceDefaults,
  useCreateDelivery,
} from "@/features/books";
import { ApiError } from "@/lib/http-client";

import { findBestOfferLinkId } from "../model/best-offer-link";

type OrderDeliveryFormProps = {
  bestOffer: Nullable<BestOfferView>;
  book: BookView;
  onDone: () => void;
  renderFields: (fields: ReactNode) => ReactNode;
  storeLinks: BookStoreLinkView[];
};

type OrderDeliveryValues = {
  expectedDeliveryDate: string;
  isFree: boolean;
  orderDate: string;
  store: StoreSourceValue;
};

export function OrderDeliveryForm({
  bestOffer,
  book,
  onDone,
  renderFields,
  storeLinks,
}: OrderDeliveryFormProps) {
  const t = useTranslations("booksToBuy.statusDialog.ordered");
  const tConfirm = useTranslations("books.details.ownership.buyConfirm");
  const tDelivery = useTranslations("books.details.delivery");
  const tErrors = useTranslations("books.details.delivery.errors");
  const tOwnershipErrors = useTranslations("books.details.ownership.errors");
  const tActions = useTranslations("books.actions");
  const createDelivery = useCreateDelivery();
  const [serverError, setServerError] = useState<null | string>(null);
  const bestOfferLinkId = findBestOfferLinkId({ bestOffer, storeLinks });

  const {
    control,
    formState: { errors },
    handleSubmit,
  } = useForm<OrderDeliveryValues>({
    defaultValues: {
      expectedDeliveryDate: "",
      isFree: false,
      orderDate: todayIso(),
      store: toStoreSourceDefaults({ bestOffer, purchaseInfo: book.purchaseInfo, storeLinks }),
    },
    mode: "onTouched",
    resolver: zodResolver(
      z
        .object({
          expectedDeliveryDate: z.string(),
          isFree: z.boolean(),
          orderDate: z
            .string()
            .refine((value) => value.length > 0, tErrors("orderDateRequired"))
            .refine(
              (value) => value.length === 0 || !isAfter(parseISO(value), new Date()),
              tErrors("orderDateFuture"),
            ),
          store: buildStoreSourceSchema({
            price: tOwnershipErrors("price"),
            priceMax: tOwnershipErrors("priceMax"),
            storeNameMax: tErrors("storeNameMax", { max: STORE_SOURCE_LIMITS.storeNameMax }),
          }).refine((value) => resolveStoreName({ storeLinks, value }).length > 0, {
            message: tErrors("storeNameRequired"),
            path: ["storeName"],
          }),
        })
        .refine(
          (values) =>
            values.expectedDeliveryDate.length === 0 ||
            values.orderDate.length === 0 ||
            !isBefore(parseISO(values.expectedDeliveryDate), parseISO(values.orderDate)),
          { message: tErrors("expectedBeforeOrder"), path: ["expectedDeliveryDate"] },
        )
        .refine((values) => values.isFree || resolveStorePrice(values.store) !== null, {
          message: tErrors("priceRequired"),
          path: ["store", "price"],
        })
        .refine((values) => !values.isFree || resolveStorePrice(values.store) === null, {
          message: tErrors("freeWithPrice"),
          path: ["store", "price"],
        }),
    ),
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    createDelivery.mutate(
      { id: book.id, payload: buildPayload({ storeLinks, values }) },
      {
        onError: (error) =>
          setServerError(error instanceof ApiError ? error.message : tErrors("generic")),
        onSuccess: onDone,
      },
    );
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      {renderFields(
        <div className="flex flex-col gap-5">
          <Controller
            control={control}
            name="store"
            render={({ field }) => (
              <StoreSourceFields
                bestOfferLinkId={bestOfferLinkId}
                errors={{ price: errors.store?.price, storeName: errors.store?.storeName }}
                onBlur={field.onBlur}
                onChange={field.onChange}
                purchaseInfo={book.purchaseInfo}
                storeLinks={storeLinks}
                value={field.value}
              />
            )}
          />

          <Controller
            control={control}
            name="isFree"
            render={({ field }) => (
              <Label className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 font-normal">
                <Checkbox
                  checked={field.value}
                  className="mt-0.5"
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium text-ink">{tDelivery("form.free")}</span>
                  <span className="text-xs text-muted-foreground">
                    {tDelivery("form.freeHint")}
                  </span>
                </span>
              </Label>
            )}
          />

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="order-delivery-order-date">{t("orderDate")}</Label>
              <Controller
                control={control}
                name="orderDate"
                render={({ field }) => (
                  <BookDateField
                    ariaLabel={t("orderDate")}
                    describedBy={errors.orderDate ? "order-delivery-order-date-error" : undefined}
                    id="order-delivery-order-date"
                    invalid={errors.orderDate !== undefined}
                    onChange={(next) => field.onChange(next ?? "")}
                    value={field.value}
                  />
                )}
              />
              <FieldError error={errors.orderDate} id="order-delivery-order-date-error" />
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="order-delivery-expected-date">{t("expectedDate")}</Label>
              <Controller
                control={control}
                name="expectedDeliveryDate"
                render={({ field }) => (
                  <BookDateField
                    allowFuture
                    ariaLabel={t("expectedDate")}
                    describedBy={
                      errors.expectedDeliveryDate ? "order-delivery-expected-date-error" : undefined
                    }
                    id="order-delivery-expected-date"
                    invalid={errors.expectedDeliveryDate !== undefined}
                    onChange={(next) => field.onChange(next ?? "")}
                    value={field.value}
                  />
                )}
              />
              <FieldError
                error={errors.expectedDeliveryDate}
                id="order-delivery-expected-date-error"
              />
            </div>
          </div>
        </div>,
      )}

      {serverError === null ? null : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {serverError}
        </p>
      )}

      <DialogFooter>
        <Button onClick={onDone} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button
          disabled={createDelivery.isPending}
          loading={createDelivery.isPending}
          type="submit"
        >
          {tConfirm("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function buildPayload({
  storeLinks,
  values,
}: {
  storeLinks: BookStoreLinkView[];
  values: OrderDeliveryValues;
}): CreateDeliveryInput {
  const payload: CreateDeliveryInput = {
    currency: values.store.currency,
    isFree: values.isFree,
    orderDate: values.orderDate,
    storeName: resolveStoreName({ storeLinks, value: values.store }),
  };
  const price = resolveStorePrice(values.store);

  if (values.expectedDeliveryDate.length > 0)
    payload.expectedDeliveryDate = values.expectedDeliveryDate;
  if (!values.isFree && price !== null) {
    payload.price = price;
  }

  return payload;
}
