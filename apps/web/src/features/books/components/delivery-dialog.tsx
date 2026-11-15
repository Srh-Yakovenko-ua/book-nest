"use client";

import type {
  BookView,
  CreateDeliveryInput,
  Currency,
  DeliveryView,
  UpdateDeliveryInput,
} from "@app/shared";

import { DEFAULT_CURRENCY, DELIVERY_INPUT_LIMITS } from "@app/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { isAfter, parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useProfileTimeZone } from "@/features/settings";
import {
  CLEAN_CLOSE_GUARD_DRAFT,
  type CloseGuardDraft,
  useCloseGuard,
} from "@/hooks/use-close-guard";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { emptyToNull } from "@/lib/empty-to-null";
import { formatNumber } from "@/lib/format";
import { isHttpsUrl } from "@/lib/is-https-url";
import { ISO_DAY, todayIsoDay } from "@/lib/iso-day";

import { useCreateDelivery, useUpdateDelivery } from "../api/use-delivery";
import { useDeliveryErrorText } from "../hooks/use-delivery-error-text";
import { BookDateField } from "./book-date-field";
import { DeliveryServiceAutocomplete } from "./delivery-service-autocomplete";
import { StoreAutocomplete } from "./store-autocomplete";

const CURRENCY_OPTIONS = ["UAH", "EUR", "USD"] as const satisfies readonly Currency[];

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
  currencyRequired: string;
  dateInvalid: string;
  expectedBeforeOrder: string;
  freeWithPrice: string;
  noteMax: string;
  orderDateFuture: string;
  orderDateRequired: string;
  orderNumberMax: string;
  price: string;
  priceMax: string;
  priceRequired: string;
  serviceMax: string;
  serviceMin: string;
  storeNameMax: string;
  storeNameRequired: string;
  trackingNumberMax: string;
  trackingUrl: string;
  trackingUrlMax: string;
};

type DeliveryValues = {
  currency: "" | Currency;
  deliveryService: string;
  expectedDeliveryDate: string;
  isFree: boolean;
  note: string;
  orderDate: string;
  orderNumber: string;
  price: string;
  storeName: string;
  trackingNumber: string;
  trackingUrl: string;
};

export function DeliveryDialog(props: DeliveryDialogProps) {
  const { onOpenChange, open } = props;
  const [draft, setDraft] = useState<CloseGuardDraft>(CLEAN_CLOSE_GUARD_DRAFT);
  const contentRef = useRef<HTMLDivElement>(null);
  const guard = useCloseGuard({
    focusFallback: () => contentRef.current?.focus(),
    isDirty: draft.isDirty,
    isOpen: open,
    isPending: draft.isPending,
    onClose: () => onOpenChange(false),
  });

  return (
    <>
      <Dialog
        onOpenChange={(next) => {
          if (!next) guard.requestClose();
        }}
        open={open}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-md" ref={contentRef}>
          {open ? (
            props.mode === "edit" ? (
              <DeliveryForm
                book={props.book}
                delivery={props.delivery}
                onCancel={guard.requestClose}
                onDone={() => onOpenChange(false)}
                onDraftChange={setDraft}
              />
            ) : (
              <DeliveryForm
                book={props.book}
                onCancel={guard.requestClose}
                onDone={() => onOpenChange(false)}
                onDraftChange={setDraft}
              />
            )
          ) : null}
        </DialogContent>
      </Dialog>

      <DiscardChangesDialog {...guard.discardDialog} />
    </>
  );
}

function buildCreatePayload(values: DeliveryValues): CreateDeliveryInput {
  const payload: CreateDeliveryInput = {
    currency: values.currency === "" ? DEFAULT_CURRENCY : values.currency,
    isFree: values.isFree,
    orderDate: values.orderDate,
    storeName: values.storeName.trim(),
  };
  const orderNumber = values.orderNumber.trim();
  const service = values.deliveryService.trim();
  const trackingNumber = values.trackingNumber.trim();
  const trackingUrl = values.trackingUrl.trim();
  const note = values.note.trim();
  const price = Number(values.price);

  if (values.expectedDeliveryDate.length > 0)
    payload.expectedDeliveryDate = values.expectedDeliveryDate;
  if (orderNumber.length > 0) payload.orderNumber = orderNumber;
  if (service.length > 0) payload.deliveryService = service;
  if (trackingNumber.length > 0) payload.trackingNumber = trackingNumber;
  if (trackingUrl.length > 0) payload.trackingUrl = trackingUrl;
  if (!values.isFree && values.price.trim().length > 0 && Number.isFinite(price)) {
    payload.price = price;
  }
  if (note.length > 0) payload.note = note;

  return payload;
}

function buildSchema({ messages, today }: { messages: DeliveryMessages; today: string }) {
  return z
    .object({
      currency: z
        .enum(["", "UAH", "EUR", "USD"])
        .refine((value) => value !== "", messages.currencyRequired),
      deliveryService: z
        .string()
        .max(DELIVERY_INPUT_LIMITS.serviceMax, messages.serviceMax)
        .refine(
          (value) =>
            value.trim().length === 0 || value.trim().length >= DELIVERY_INPUT_LIMITS.serviceMin,
          messages.serviceMin,
        ),
      expectedDeliveryDate: z
        .string()
        .refine((value) => value.length === 0 || ISO_DAY.pattern.test(value), messages.dateInvalid),
      isFree: z.boolean(),
      note: z.string().max(DELIVERY_INPUT_LIMITS.noteMax, messages.noteMax),
      orderDate: z
        .string()
        .refine((value) => value.length > 0, messages.orderDateRequired)
        .refine((value) => value.length === 0 || ISO_DAY.pattern.test(value), messages.dateInvalid)
        .refine(
          (value) => value.length === 0 || !isAfter(parseISO(value), parseISO(today)),
          messages.orderDateFuture,
        ),
      orderNumber: z.string().max(DELIVERY_INPUT_LIMITS.orderNumberMax, messages.orderNumberMax),
      price: z
        .string()
        .refine(
          (value) => value.trim().length === 0 || Number(value) > DELIVERY_INPUT_LIMITS.priceMin,
          messages.price,
        )
        .refine(
          (value) => value.trim().length === 0 || Number(value) <= DELIVERY_INPUT_LIMITS.priceMax,
          messages.priceMax,
        ),
      storeName: z
        .string()
        .refine((value) => value.trim().length > 0, messages.storeNameRequired)
        .refine(
          (value) => value.trim().length <= DELIVERY_INPUT_LIMITS.storeNameMax,
          messages.storeNameMax,
        ),
      trackingNumber: z
        .string()
        .max(DELIVERY_INPUT_LIMITS.trackingNumberMax, messages.trackingNumberMax),
      trackingUrl: z
        .string()
        .refine(
          (value) => value.trim().length === 0 || isHttpsUrl(value.trim()),
          messages.trackingUrl,
        )
        .refine(
          (value) => value.trim().length <= DELIVERY_INPUT_LIMITS.trackingUrlMax,
          messages.trackingUrlMax,
        ),
    })
    .refine(
      (value) =>
        value.expectedDeliveryDate.length === 0 ||
        value.orderDate.length === 0 ||
        value.expectedDeliveryDate >= value.orderDate,
      { message: messages.expectedBeforeOrder, path: ["expectedDeliveryDate"] },
    )
    .refine((value) => value.isFree || value.price.trim().length > 0, {
      message: messages.priceRequired,
      path: ["price"],
    })
    .refine((value) => !value.isFree || value.price.trim().length === 0, {
      message: messages.freeWithPrice,
      path: ["price"],
    });
}

function buildUpdatePayload(values: DeliveryValues): UpdateDeliveryInput {
  const price = Number(values.price);
  const hasPrice = values.price.trim().length > 0 && Number.isFinite(price);

  return {
    currency: values.currency === "" ? DEFAULT_CURRENCY : values.currency,
    deliveryService: emptyToNull(values.deliveryService),
    expectedDeliveryDate: emptyToNull(values.expectedDeliveryDate),
    isFree: values.isFree,
    note: emptyToNull(values.note),
    orderDate: values.orderDate,
    orderNumber: emptyToNull(values.orderNumber),
    price: values.isFree || !hasPrice ? null : price,
    storeName: values.storeName.trim(),
    trackingNumber: emptyToNull(values.trackingNumber),
    trackingUrl: emptyToNull(values.trackingUrl),
  };
}

function DeliveryForm({
  book,
  delivery,
  onCancel,
  onDone,
  onDraftChange,
}: {
  book: BookView;
  delivery?: DeliveryView;
  onCancel: () => void;
  onDone: () => void;
  onDraftChange: (draft: CloseGuardDraft) => void;
}) {
  const locale = useLocale();
  const t = useTranslations("books.details.delivery");
  const tErrors = useTranslations("books.details.delivery.errors");
  const deliveryErrorText = useDeliveryErrorText();
  const tActions = useTranslations("books.actions");
  const createDelivery = useCreateDelivery();
  const updateDelivery = useUpdateDelivery();
  const [serverError, setServerError] = useState<null | string>(null);
  const today = todayIsoDay(useProfileTimeZone());

  const isEdit = delivery !== undefined;
  const pending = isEdit ? updateDelivery.isPending : createDelivery.isPending;

  const {
    control,
    formState: { errors, isDirty },
    getFieldState,
    getValues,
    handleSubmit,
    register,
    resetField,
  } = useForm<DeliveryValues>({
    defaultValues: toDefaults({ delivery, today }),
    mode: "onTouched",
    resolver: zodResolver(
      buildSchema({
        messages: {
          currencyRequired: tErrors("currencyRequired"),
          dateInvalid: tErrors("dateInvalid"),
          expectedBeforeOrder: tErrors("expectedBeforeOrder"),
          freeWithPrice: tErrors("freeWithPrice"),
          noteMax: tErrors("noteMax", { max: DELIVERY_INPUT_LIMITS.noteMax }),
          orderDateFuture: tErrors("orderDateFuture"),
          orderDateRequired: tErrors("orderDateRequired"),
          orderNumberMax: tErrors("orderNumberMax", {
            max: DELIVERY_INPUT_LIMITS.orderNumberMax,
          }),
          price: tErrors("price"),
          priceMax: tErrors("priceMax", {
            max: formatNumber(DELIVERY_INPUT_LIMITS.priceMax, locale),
          }),
          priceRequired: tErrors("priceRequired"),
          serviceMax: tErrors("serviceMax", { max: DELIVERY_INPUT_LIMITS.serviceMax }),
          serviceMin: tErrors("serviceMin", { min: DELIVERY_INPUT_LIMITS.serviceMin }),
          storeNameMax: tErrors("storeNameMax", { max: DELIVERY_INPUT_LIMITS.storeNameMax }),
          storeNameRequired: tErrors("storeNameRequired"),
          trackingNumberMax: tErrors("trackingNumberMax", {
            max: DELIVERY_INPUT_LIMITS.trackingNumberMax,
          }),
          trackingUrl: tErrors("trackingUrl"),
          trackingUrlMax: tErrors("trackingUrlMax", {
            max: DELIVERY_INPUT_LIMITS.trackingUrlMax,
          }),
        },
        today,
      }),
    ),
  });

  const isFree = useWatch({ control, name: "isFree" });

  useEffect(() => {
    onDraftChange({ isDirty, isPending: pending });
  }, [isDirty, onDraftChange, pending]);

  useEffect(() => {
    if (isEdit || getFieldState("orderDate").isDirty || getValues("orderDate") === today) return;
    resetField("orderDate", { defaultValue: today });
  }, [getFieldState, getValues, isEdit, resetField, today]);

  const onSubmit = handleSubmit((values) => {
    setServerError(null);
    const onError = (error: Error) => setServerError(deliveryErrorText(error));

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
                required
                today={today}
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
                today={today}
                value={field.value}
              />
            )}
          />
          <FieldError error={errors.expectedDeliveryDate} id="delivery-expected-date-error" />
        </div>
      </div>

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

      <div className="flex flex-col gap-2">
        <Label htmlFor="delivery-tracking-url">{t("form.trackingUrl")}</Label>
        <Input
          aria-describedby={errors.trackingUrl ? "delivery-tracking-url-error" : undefined}
          aria-invalid={errors.trackingUrl !== undefined}
          autoComplete="off"
          className="h-10"
          id="delivery-tracking-url"
          inputMode="url"
          placeholder={t("form.trackingUrlPlaceholder")}
          {...register("trackingUrl")}
        />
        <FieldError error={errors.trackingUrl} id="delivery-tracking-url-error" />
      </div>

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
              <span className="font-medium text-ink">{t("form.free")}</span>
              <span className="text-xs text-muted-foreground">{t("form.freeHint")}</span>
            </span>
          </Label>
        )}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="delivery-price">{t("form.price")}</Label>
          <Input
            aria-describedby={errors.price ? "delivery-price-error" : undefined}
            aria-invalid={errors.price !== undefined}
            className="h-10"
            disabled={isFree}
            id="delivery-price"
            inputMode="decimal"
            min={DELIVERY_INPUT_LIMITS.priceMin}
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
                maxLength={DELIVERY_INPUT_LIMITS.noteMax}
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
                  {field.value.length}/{DELIVERY_INPUT_LIMITS.noteMax}
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
        <Button onClick={onCancel} type="button" variant="secondary">
          {tActions("cancel")}
        </Button>
        <Button disabled={pending} loading={pending} type="submit">
          {isEdit ? t("form.saveSubmit") : t("form.createSubmit")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function toDefaults({
  delivery,
  today,
}: {
  delivery: DeliveryView | undefined;
  today: string;
}): DeliveryValues {
  return {
    currency: delivery === undefined ? "UAH" : (delivery.currency ?? "UAH"),
    deliveryService: delivery?.deliveryService ?? "",
    expectedDeliveryDate: delivery?.expectedDeliveryDate ?? "",
    isFree: delivery?.isFree ?? false,
    note: delivery?.note ?? "",
    orderDate: delivery?.orderDate ?? today,
    orderNumber: delivery?.orderNumber ?? "",
    price: delivery?.price != null ? String(delivery.price) : "",
    storeName: delivery?.storeName ?? "",
    trackingNumber: delivery?.trackingNumber ?? "",
    trackingUrl: delivery?.trackingUrl ?? "",
  };
}
