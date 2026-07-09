"use client";

import type {
  ActiveDeliveryStatus,
  BookView,
  CreateDeliveryInput,
  Currency,
  DeliveryView,
  UpdateDeliveryInput,
} from "@app/shared";

import { DELIVERY_ACTIVE_STATUSES, isActiveDeliveryStatus } from "@app/shared";
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

import { useCreateDelivery, useUpdateDelivery } from "../api/use-delivery";
import { ISO_DATE_PATTERN, todayIso } from "../model/reading-progress";
import { BookDateField } from "./book-date-field";
import { DeliveryServiceAutocomplete } from "./delivery-service-autocomplete";
import { StoreAutocomplete } from "./store-autocomplete";

const CURRENCY_OPTIONS = ["UAH", "EUR", "USD"] as const satisfies readonly Currency[];
const STORE_NAME_MAX = 100;
const ORDER_NUMBER_MAX = 100;
const SERVICE_MIN = 2;
const SERVICE_MAX = 100;
const TRACKING_NUMBER_MAX = 100;
const NOTE_MAX = 300;
const PRICE_MIN = 0;
const PRICE_MAX = 99999999.99;

type DeliveryDialogProps =
  | {
      book: BookView;
      delivery: DeliveryView;
      mode: "edit";
      onOpenChange: (open: boolean) => void;
      open: boolean;
    }
  | {
      book: BookView;
      mode: "create";
      onOpenChange: (open: boolean) => void;
      open: boolean;
    };

type DeliveryMessages = {
  dateInvalid: string;
  expectedBeforeOrder: string;
  noteMax: string;
  orderDateFuture: string;
  orderDateRequired: string;
  orderNumberMax: string;
  price: string;
  priceMax: string;
  serviceMax: string;
  serviceMin: string;
  storeNameMax: string;
  storeNameRequired: string;
  trackingNumberMax: string;
};

type DeliveryValues = {
  currency: "" | Currency;
  deliveryService: string;
  expectedDeliveryDate: string;
  note: string;
  orderDate: string;
  orderNumber: string;
  price: string;
  status: ActiveDeliveryStatus;
  storeName: string;
  trackingNumber: string;
};

export function DeliveryDialog(props: DeliveryDialogProps) {
  const { onOpenChange, open } = props;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md">
        {open ? (
          props.mode === "edit" ? (
            <DeliveryForm
              book={props.book}
              delivery={props.delivery}
              onDone={() => onOpenChange(false)}
            />
          ) : (
            <DeliveryForm book={props.book} onDone={() => onOpenChange(false)} />
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function buildCreatePayload(values: DeliveryValues): CreateDeliveryInput {
  const payload: CreateDeliveryInput = {
    orderDate: values.orderDate,
    storeName: values.storeName.trim(),
  };
  const orderNumber = values.orderNumber.trim();
  const service = values.deliveryService.trim();
  const trackingNumber = values.trackingNumber.trim();
  const note = values.note.trim();
  const price = Number(values.price);

  if (values.expectedDeliveryDate.length > 0)
    payload.expectedDeliveryDate = values.expectedDeliveryDate;
  if (orderNumber.length > 0) payload.orderNumber = orderNumber;
  if (service.length > 0) payload.deliveryService = service;
  if (trackingNumber.length > 0) payload.trackingNumber = trackingNumber;
  if (values.price.trim().length > 0 && Number.isFinite(price)) payload.price = price;
  if (values.currency !== "") payload.currency = values.currency;
  if (note.length > 0) payload.note = note;

  return payload;
}

function buildSchema(messages: DeliveryMessages) {
  return z
    .object({
      currency: z.enum(["", "UAH", "EUR", "USD"]),
      deliveryService: z
        .string()
        .max(SERVICE_MAX, messages.serviceMax)
        .refine(
          (value) => value.trim().length === 0 || value.trim().length >= SERVICE_MIN,
          messages.serviceMin,
        ),
      expectedDeliveryDate: z
        .string()
        .refine(
          (value) => value.length === 0 || ISO_DATE_PATTERN.test(value),
          messages.dateInvalid,
        ),
      note: z.string().max(NOTE_MAX, messages.noteMax),
      orderDate: z
        .string()
        .refine((value) => value.length > 0, messages.orderDateRequired)
        .refine((value) => value.length === 0 || ISO_DATE_PATTERN.test(value), messages.dateInvalid)
        .refine((value) => value.length === 0 || value <= todayIso(), messages.orderDateFuture),
      orderNumber: z.string().max(ORDER_NUMBER_MAX, messages.orderNumberMax),
      price: z
        .string()
        .refine((value) => value.trim().length === 0 || Number(value) > PRICE_MIN, messages.price)
        .refine(
          (value) => value.trim().length === 0 || Number(value) <= PRICE_MAX,
          messages.priceMax,
        ),
      status: z.enum(DELIVERY_ACTIVE_STATUSES),
      storeName: z
        .string()
        .refine((value) => value.trim().length > 0, messages.storeNameRequired)
        .refine((value) => value.trim().length <= STORE_NAME_MAX, messages.storeNameMax),
      trackingNumber: z.string().max(TRACKING_NUMBER_MAX, messages.trackingNumberMax),
    })
    .refine(
      (value) =>
        value.expectedDeliveryDate.length === 0 ||
        value.orderDate.length === 0 ||
        value.expectedDeliveryDate >= value.orderDate,
      { message: messages.expectedBeforeOrder, path: ["expectedDeliveryDate"] },
    );
}

function buildUpdatePayload(values: DeliveryValues): UpdateDeliveryInput {
  const price = Number(values.price);
  const hasPrice = values.price.trim().length > 0 && Number.isFinite(price);

  return {
    currency: values.currency === "" ? null : values.currency,
    deliveryService: emptyToNull(values.deliveryService.trim()),
    expectedDeliveryDate: emptyToNull(values.expectedDeliveryDate),
    note: emptyToNull(values.note.trim()),
    orderDate: values.orderDate,
    orderNumber: emptyToNull(values.orderNumber.trim()),
    price: hasPrice ? price : null,
    status: values.status,
    storeName: values.storeName.trim(),
    trackingNumber: emptyToNull(values.trackingNumber.trim()),
  };
}

function DeliveryForm({
  book,
  delivery,
  onDone,
}: {
  book: BookView;
  delivery?: DeliveryView;
  onDone: () => void;
}) {
  const t = useTranslations("books.details.delivery");
  const tErrors = useTranslations("books.details.delivery.errors");
  const tStatus = useTranslations("books.deliveryStatus.labels");
  const tActions = useTranslations("books.actions");
  const createDelivery = useCreateDelivery();
  const updateDelivery = useUpdateDelivery();
  const [serverError, setServerError] = useState<null | string>(null);

  const isEdit = delivery !== undefined;
  const pending = isEdit ? updateDelivery.isPending : createDelivery.isPending;

  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<DeliveryValues>({
    defaultValues: toDefaults(delivery),
    mode: "onTouched",
    resolver: zodResolver(
      buildSchema({
        dateInvalid: tErrors("dateInvalid"),
        expectedBeforeOrder: tErrors("expectedBeforeOrder"),
        noteMax: tErrors("noteMax", { max: NOTE_MAX }),
        orderDateFuture: tErrors("orderDateFuture"),
        orderDateRequired: tErrors("orderDateRequired"),
        orderNumberMax: tErrors("orderNumberMax", { max: ORDER_NUMBER_MAX }),
        price: tErrors("price"),
        priceMax: tErrors("priceMax"),
        serviceMax: tErrors("serviceMax", { max: SERVICE_MAX }),
        serviceMin: tErrors("serviceMin", { min: SERVICE_MIN }),
        storeNameMax: tErrors("storeNameMax", { max: STORE_NAME_MAX }),
        storeNameRequired: tErrors("storeNameRequired"),
        trackingNumberMax: tErrors("trackingNumberMax", { max: TRACKING_NUMBER_MAX }),
      }),
    ),
  });

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    const onError = (error: Error) =>
      setServerError(error instanceof ApiError ? error.message : tErrors("generic"));

    if (delivery !== undefined) {
      updateDelivery.mutate(
        { deliveryId: delivery.id, id: book.id, payload: buildUpdatePayload(values) },
        { onError, onSuccess: onDone },
      );
      return;
    }

    createDelivery.mutate(
      { id: book.id, payload: buildCreatePayload(values) },
      { onError, onSuccess: onDone },
    );
  });

  return (
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      <DialogHeader>
        <DialogTitle>{isEdit ? t("editDialog.title") : t("createDialog.title")}</DialogTitle>
        <DialogDescription>
          {isEdit ? t("editDialog.description") : t("createDialog.description")}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <Label htmlFor="delivery-store-name">{t("form.storeName")}</Label>
        <Controller
          control={control}
          name="storeName"
          render={({ field }) => (
            <StoreAutocomplete
              describedBy={errors.storeName ? "delivery-store-name-error" : undefined}
              id="delivery-store-name"
              invalid={errors.storeName !== undefined}
              label={t("form.storeName")}
              onChange={(next) => field.onChange(next)}
              placeholder={t("form.storeNamePlaceholder")}
              value={field.value}
            />
          )}
        />
        <FieldError error={errors.storeName} id="delivery-store-name-error" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="delivery-order-date">{t("form.orderDate")}</Label>
          <Controller
            control={control}
            name="orderDate"
            render={({ field }) => (
              <BookDateField
                ariaLabel={t("form.orderDate")}
                describedBy={errors.orderDate ? "delivery-order-date-error" : undefined}
                id="delivery-order-date"
                invalid={errors.orderDate !== undefined}
                onChange={(next) => field.onChange(next ?? "")}
                placeholder={t("form.datePlaceholder")}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.orderDate} id="delivery-order-date-error" />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="delivery-expected-date">{t("form.expectedDeliveryDate")}</Label>
          <Controller
            control={control}
            name="expectedDeliveryDate"
            render={({ field }) => (
              <BookDateField
                allowFuture
                ariaLabel={t("form.expectedDeliveryDate")}
                describedBy={
                  errors.expectedDeliveryDate ? "delivery-expected-date-error" : undefined
                }
                id="delivery-expected-date"
                invalid={errors.expectedDeliveryDate !== undefined}
                onChange={(next) => field.onChange(next ?? "")}
                placeholder={t("form.datePlaceholder")}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.expectedDeliveryDate} id="delivery-expected-date-error" />
        </div>
      </div>

      {isEdit ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="delivery-status">{t("editDialog.status")}</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger
                  className="h-10 w-full data-[size=default]:h-10"
                  id="delivery-status"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DELIVERY_ACTIVE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {tStatus(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="delivery-service">{t("form.deliveryService")}</Label>
        <Controller
          control={control}
          name="deliveryService"
          render={({ field }) => (
            <DeliveryServiceAutocomplete
              describedBy={errors.deliveryService ? "delivery-service-error" : undefined}
              id="delivery-service"
              invalid={errors.deliveryService !== undefined}
              label={t("form.deliveryService")}
              onChange={field.onChange}
              placeholder={t("form.deliveryServicePlaceholder")}
              value={field.value}
            />
          )}
        />
        <FieldError error={errors.deliveryService} id="delivery-service-error" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="delivery-order-number">{t("form.orderNumber")}</Label>
          <Input
            aria-describedby={errors.orderNumber ? "delivery-order-number-error" : undefined}
            aria-invalid={errors.orderNumber !== undefined}
            autoComplete="off"
            className="h-10"
            id="delivery-order-number"
            placeholder={t("form.orderNumberPlaceholder")}
            {...register("orderNumber")}
          />
          <FieldError error={errors.orderNumber} id="delivery-order-number-error" />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="delivery-tracking-number">{t("form.trackingNumber")}</Label>
          <Input
            aria-describedby={errors.trackingNumber ? "delivery-tracking-number-error" : undefined}
            aria-invalid={errors.trackingNumber !== undefined}
            autoComplete="off"
            className="h-10"
            id="delivery-tracking-number"
            placeholder={t("form.trackingNumberPlaceholder")}
            {...register("trackingNumber")}
          />
          <FieldError error={errors.trackingNumber} id="delivery-tracking-number-error" />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="delivery-price">{t("form.price")}</Label>
          <Input
            aria-describedby={errors.price ? "delivery-price-error" : undefined}
            aria-invalid={errors.price !== undefined}
            className="h-10"
            id="delivery-price"
            inputMode="decimal"
            min={0}
            onKeyDown={blockNegativeNumberKeys}
            onPaste={blockNegativeNumberPaste}
            placeholder="0"
            step="0.01"
            type="number"
            {...register("price")}
          />
          <FieldError error={errors.price} id="delivery-price-error" />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="delivery-currency">{t("form.currency")}</Label>
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
                    id="delivery-currency"
                    isClearable={field.value !== ""}
                    onClear={() => field.onChange("")}
                  >
                    <SelectValue placeholder={t("form.currencyPlaceholder")} />
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
        <Label htmlFor="delivery-note">{t("form.note")}</Label>
        <Controller
          control={control}
          name="note"
          render={({ field }) => (
            <>
              <Textarea
                aria-describedby={
                  errors.note
                    ? "delivery-note-error delivery-note-counter"
                    : "delivery-note-counter"
                }
                aria-invalid={errors.note !== undefined}
                id="delivery-note"
                maxLength={NOTE_MAX}
                onChange={field.onChange}
                placeholder={t("form.notePlaceholder")}
                value={field.value}
              />
              <div className="flex items-center justify-between gap-2">
                <FieldError error={errors.note} id="delivery-note-error" />
                <span
                  className="ml-auto text-xs text-muted-foreground tabular-nums"
                  id="delivery-note-counter"
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
        <Button disabled={pending} loading={pending} type="submit">
          {isEdit ? t("form.saveSubmit") : t("form.createSubmit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function emptyToNull(value: string): null | string {
  return value.length > 0 ? value : null;
}

function toDefaults(delivery: DeliveryView | undefined): DeliveryValues {
  return {
    currency: delivery === undefined ? "UAH" : (delivery.currency ?? ""),
    deliveryService: delivery?.deliveryService ?? "",
    expectedDeliveryDate: delivery?.expectedDeliveryDate ?? "",
    note: delivery?.note ?? "",
    orderDate: delivery?.orderDate ?? todayIso(),
    orderNumber: delivery?.orderNumber ?? "",
    price: delivery?.price != null ? String(delivery.price) : "",
    status:
      delivery !== undefined && isActiveDeliveryStatus(delivery.status)
        ? delivery.status
        : "ordered",
    storeName: delivery?.storeName ?? "",
    trackingNumber: delivery?.trackingNumber ?? "",
  };
}
