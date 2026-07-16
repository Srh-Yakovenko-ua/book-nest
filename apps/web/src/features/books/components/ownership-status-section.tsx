"use client";

import type { OwnershipStatus } from "@app/shared";

import { useTranslations } from "next-intl";
import {
  type Control,
  Controller,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
  useWatch,
} from "react-hook-form";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
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
import { Link } from "@/i18n/navigation";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { ownershipStatuses } from "@/lib/book-status";

import type { BookFormMode } from "../model/book-form-mode";
import type { CreateBookFormValues } from "../model/create-book-form";

import {
  CREATE_DELIVERY_STATUS_OPTIONS,
  EDIT_DELIVERY_STATUS_OPTIONS,
  OWNERSHIP_STATUS_OPTIONS,
  ownershipUsesDelivery,
  ownershipUsesLoan,
  ownershipUsesPurchase,
} from "../model/book-status-fields";
import { OWNERSHIP_FIELDS } from "../model/section-completeness";
import { BookDateField } from "./book-date-field";
import { DeliveryServiceAutocomplete } from "./delivery-service-autocomplete";
import { FormSection } from "./form-section";
import { StatusChipGroup } from "./status-chip-group";
import { StoreAutocomplete } from "./store-autocomplete";
import { useSectionCompletion } from "./use-section-completion";

const CURRENCY_OPTIONS = ["UAH", "EUR", "USD"] as const;
const PRICE_MAX = 1000000;

type OwnershipNoteFieldProps = {
  error?: { message?: string };
  id: string;
  label: string;
  name: OwnershipNoteName;
  placeholder: string;
  register: UseFormRegister<CreateBookFormValues>;
};

type OwnershipNoteName = "deliveryInfo.note" | "loanInfo.note" | "purchaseInfo.note";

type OwnershipStatusSectionProps = {
  control: Control<CreateBookFormValues>;
  errors: FieldErrors<CreateBookFormValues>;
  mode: BookFormMode;
  onRequestChange?: (next: OwnershipStatus, apply: () => void) => void;
  register: UseFormRegister<CreateBookFormValues>;
  setValue: UseFormSetValue<CreateBookFormValues>;
};

export function OwnershipStatusSection({
  control,
  errors,
  mode,
  onRequestChange,
  register,
  setValue,
}: OwnershipStatusSectionProps) {
  const t = useTranslations("books");
  const status = useWatch({ control, name: "ownershipStatus" }) ?? "none";
  const deliveryStatusOptions =
    mode === "edit" ? EDIT_DELIVERY_STATUS_OPTIONS : CREATE_DELIVERY_STATUS_OPTIONS;
  const complete = useSectionCompletion(control, OWNERSHIP_FIELDS);

  return (
    <FormSection
      complete={complete}
      completeLabel={t("form.sectionComplete")}
      description={t("ownershipStatus.description")}
      icon="package"
      title={t("ownershipStatus.title")}
    >
      <Controller
        control={control}
        name="ownershipStatus"
        render={({ field }) => (
          <StatusChipGroup
            label={t("ownershipStatus.title")}
            onValueChange={(next) => {
              const apply = () => field.onChange(next);
              if (onRequestChange) onRequestChange(next as OwnershipStatus, apply);
              else apply();
            }}
            options={OWNERSHIP_STATUS_OPTIONS.map((value) => {
              const entry = ownershipStatuses.find((item) => item.value === value);
              return {
                icon: entry ? <UiIcon name={entry.icon} /> : undefined,
                label: t(`ownershipStatus.options.${value}`),
                value,
              };
            })}
            value={field.value ?? "none"}
          />
        )}
      />

      {ownershipUsesPurchase(status) ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 rounded-md border border-border bg-secondary/40 p-4 motion-safe:animate-in motion-safe:duration-300 motion-safe:slide-in-from-top-1">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">{t("purchaseInfo.title")}</p>
              <p className="text-sm text-muted-foreground">{t("purchaseInfo.subtitle")}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="purchase-store-name">{t("purchaseInfo.fields.storeName")}</Label>
              <Controller
                control={control}
                name="purchaseInfo.storeName"
                render={({ field }) => (
                  <StoreAutocomplete
                    describedBy={
                      errors.purchaseInfo?.storeName ? "purchase-store-name-error" : undefined
                    }
                    id="purchase-store-name"
                    invalid={errors.purchaseInfo?.storeName !== undefined}
                    label={t("purchaseInfo.fields.storeName")}
                    onChange={(next) => field.onChange(next.length === 0 ? undefined : next)}
                    placeholder={t("purchaseInfo.fields.storeNamePlaceholder")}
                    value={typeof field.value === "string" ? field.value : ""}
                  />
                )}
              />
              <FieldError error={errors.purchaseInfo?.storeName} id="purchase-store-name-error" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="purchase-store-url">{t("purchaseInfo.fields.storeUrl")}</Label>
              <Input
                aria-describedby={
                  errors.purchaseInfo?.storeUrl ? "purchase-store-url-error" : undefined
                }
                aria-invalid={errors.purchaseInfo?.storeUrl !== undefined}
                autoComplete="off"
                className="h-10"
                id="purchase-store-url"
                inputMode="url"
                placeholder={t("purchaseInfo.fields.storeUrlPlaceholder")}
                {...register("purchaseInfo.storeUrl", { setValueAs: emptyToUndefined })}
              />
              <FieldError error={errors.purchaseInfo?.storeUrl} id="purchase-store-url-error" />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 flex-col gap-2">
                <Label htmlFor="purchase-expected-price">
                  {t("purchaseInfo.fields.expectedPrice")}
                </Label>
                <Input
                  aria-invalid={errors.purchaseInfo?.expectedPrice !== undefined}
                  className="h-10"
                  id="purchase-expected-price"
                  inputMode="decimal"
                  min={0}
                  onKeyDown={blockNegativeNumberKeys}
                  onPaste={blockNegativeNumberPaste}
                  placeholder="0"
                  step="0.01"
                  type="number"
                  {...register("purchaseInfo.expectedPrice", {
                    setValueAs: (value) => {
                      if (typeof value !== "string" || value.trim().length === 0) return undefined;
                      const parsed = Number(value);
                      return Number.isFinite(parsed) ? Math.min(parsed, PRICE_MAX) : undefined;
                    },
                  })}
                />
                <FieldError
                  error={errors.purchaseInfo?.expectedPrice}
                  id="purchase-expected-price-error"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="purchase-currency">{t("purchaseInfo.fields.currency")}</Label>
                <Controller
                  control={control}
                  name="purchaseInfo.currency"
                  render={({ field }) => (
                    <div className="w-full sm:w-28">
                      <Select
                        onValueChange={field.onChange}
                        value={typeof field.value === "string" ? field.value : undefined}
                      >
                        <SelectTrigger
                          className="h-10 w-full data-[size=default]:h-10"
                          id="purchase-currency"
                          isClearable={typeof field.value === "string" && field.value !== "UAH"}
                          onClear={() => field.onChange("UAH")}
                        >
                          <SelectValue placeholder={t("purchaseInfo.fields.currencyPlaceholder")} />
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

          <p className="text-sm text-muted-foreground">
            {t.rich("purchaseInfo.moreStoresHint", {
              link: (chunks) => (
                <Link
                  className="text-primary underline-offset-2 hover:underline"
                  href="/books-to-buy"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {chunks}
                </Link>
              ),
            })}
          </p>

          <OwnershipNoteField
            error={errors.purchaseInfo?.note}
            id="purchase-note"
            label={t("ownershipStatus.fields.note")}
            name="purchaseInfo.note"
            placeholder={t("ownershipStatus.fields.notePlaceholder")}
            register={register}
          />
        </div>
      ) : null}

      {ownershipUsesDelivery(status) ? (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-secondary/40 p-4 motion-safe:animate-in motion-safe:duration-300 motion-safe:slide-in-from-top-1">
          <p className="text-sm font-medium text-foreground">{t("deliveryInfo.title")}</p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="delivery-store-name">{t("deliveryInfo.fields.storeName")}</Label>
            <Controller
              control={control}
              name="deliveryInfo.storeName"
              render={({ field }) => (
                <StoreAutocomplete
                  describedBy={
                    errors.deliveryInfo?.storeName ? "delivery-store-name-error" : undefined
                  }
                  id="delivery-store-name"
                  invalid={errors.deliveryInfo?.storeName !== undefined}
                  label={t("deliveryInfo.fields.storeName")}
                  onChange={(next) => field.onChange(next.length === 0 ? undefined : next)}
                  placeholder={t("purchaseInfo.fields.storeNamePlaceholder")}
                  value={typeof field.value === "string" ? field.value : ""}
                />
              )}
            />
            <FieldError error={errors.deliveryInfo?.storeName} id="delivery-store-name-error" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="delivery-service">{t("deliveryInfo.fields.deliveryService")}</Label>
            <Controller
              control={control}
              name="deliveryInfo.deliveryService"
              render={({ field }) => (
                <DeliveryServiceAutocomplete
                  describedBy={
                    errors.deliveryInfo?.deliveryService ? "delivery-service-error" : undefined
                  }
                  id="delivery-service"
                  invalid={errors.deliveryInfo?.deliveryService !== undefined}
                  label={t("deliveryInfo.fields.deliveryService")}
                  onChange={(next) => field.onChange(next.length === 0 ? undefined : next)}
                  placeholder={t("deliveryInfo.fields.deliveryServicePlaceholder")}
                  value={typeof field.value === "string" ? field.value : ""}
                />
              )}
            />
            <FieldError error={errors.deliveryInfo?.deliveryService} id="delivery-service-error" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="delivery-order-number">{t("deliveryInfo.fields.orderNumber")}</Label>
              <Input
                aria-invalid={errors.deliveryInfo?.orderNumber !== undefined}
                autoComplete="off"
                className="h-10"
                id="delivery-order-number"
                placeholder={t("deliveryInfo.fields.orderNumberPlaceholder")}
                {...register("deliveryInfo.orderNumber", { setValueAs: emptyToUndefined })}
              />
              <FieldError
                error={errors.deliveryInfo?.orderNumber}
                id="delivery-order-number-error"
              />
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="delivery-tracking-number">
                {t("deliveryInfo.fields.trackingNumber")}
              </Label>
              <Input
                aria-invalid={errors.deliveryInfo?.trackingNumber !== undefined}
                autoComplete="off"
                className="h-10"
                id="delivery-tracking-number"
                placeholder={t("deliveryInfo.fields.trackingNumberPlaceholder")}
                {...register("deliveryInfo.trackingNumber", { setValueAs: emptyToUndefined })}
              />
              <FieldError
                error={errors.deliveryInfo?.trackingNumber}
                id="delivery-tracking-number-error"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="delivery-order-date">{t("deliveryInfo.fields.orderDate")}</Label>
              <Controller
                control={control}
                name="deliveryInfo.orderDate"
                render={({ field }) => (
                  <BookDateField
                    ariaLabel={t("deliveryInfo.fields.orderDate")}
                    describedBy={
                      errors.deliveryInfo?.orderDate ? "delivery-order-date-error" : undefined
                    }
                    id="delivery-order-date"
                    invalid={errors.deliveryInfo?.orderDate !== undefined}
                    onChange={field.onChange}
                    placeholder={t("ownershipStatus.fields.datePlaceholder")}
                    value={field.value}
                  />
                )}
              />
              <FieldError error={errors.deliveryInfo?.orderDate} id="delivery-order-date-error" />
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="delivery-expected-date">
                {t("deliveryInfo.fields.expectedDeliveryDate")}
              </Label>
              <Controller
                control={control}
                name="deliveryInfo.expectedDeliveryDate"
                render={({ field }) => (
                  <BookDateField
                    allowFuture
                    ariaLabel={t("deliveryInfo.fields.expectedDeliveryDate")}
                    describedBy={
                      errors.deliveryInfo?.expectedDeliveryDate
                        ? "delivery-expected-date-error"
                        : undefined
                    }
                    id="delivery-expected-date"
                    invalid={errors.deliveryInfo?.expectedDeliveryDate !== undefined}
                    onChange={field.onChange}
                    placeholder={t("ownershipStatus.fields.datePlaceholder")}
                    value={field.value}
                  />
                )}
              />
              <FieldError
                error={errors.deliveryInfo?.expectedDeliveryDate}
                id="delivery-expected-date-error"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="delivery-price">{t("deliveryInfo.fields.price")}</Label>
              <Input
                aria-invalid={errors.deliveryInfo?.price !== undefined}
                className="h-10"
                id="delivery-price"
                inputMode="decimal"
                min={0}
                onKeyDown={blockNegativeNumberKeys}
                onPaste={blockNegativeNumberPaste}
                placeholder="0"
                step="0.01"
                type="number"
                {...register("deliveryInfo.price", {
                  setValueAs: (value) => {
                    if (typeof value !== "string" || value.trim().length === 0) return undefined;
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? Math.min(parsed, PRICE_MAX) : undefined;
                  },
                })}
              />
              <FieldError error={errors.deliveryInfo?.price} id="delivery-price-error" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="delivery-currency">{t("deliveryInfo.fields.currency")}</Label>
              <Controller
                control={control}
                name="deliveryInfo.currency"
                render={({ field }) => (
                  <div className="w-full sm:w-28">
                    <Select
                      onValueChange={field.onChange}
                      value={typeof field.value === "string" ? field.value : undefined}
                    >
                      <SelectTrigger
                        className="h-10 w-full data-[size=default]:h-10"
                        id="delivery-currency"
                        isClearable={typeof field.value === "string"}
                        onClear={() => field.onChange(undefined)}
                      >
                        <SelectValue placeholder={t("deliveryInfo.fields.currencyPlaceholder")} />
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
            <Label htmlFor="delivery-tracking-url">{t("deliveryInfo.fields.trackingUrl")}</Label>
            <Input
              aria-describedby={
                errors.deliveryInfo?.trackingUrl ? "delivery-tracking-url-error" : undefined
              }
              aria-invalid={errors.deliveryInfo?.trackingUrl !== undefined}
              autoComplete="off"
              className="h-10"
              id="delivery-tracking-url"
              inputMode="url"
              placeholder={t("deliveryInfo.fields.trackingUrlPlaceholder")}
              {...register("deliveryInfo.trackingUrl", { setValueAs: emptyToUndefined })}
            />
            <FieldError error={errors.deliveryInfo?.trackingUrl} id="delivery-tracking-url-error" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="delivery-status">{t("deliveryInfo.fields.deliveryStatus")}</Label>
            <Controller
              control={control}
              name="deliveryInfo.deliveryStatus"
              render={({ field }) => (
                <Select
                  onValueChange={field.onChange}
                  value={typeof field.value === "string" ? field.value : undefined}
                >
                  <SelectTrigger
                    className="h-10 w-full data-[size=default]:h-10"
                    id="delivery-status"
                    isClearable={typeof field.value === "string"}
                    onClear={() => field.onChange(undefined)}
                  >
                    <SelectValue placeholder={t("deliveryInfo.fields.deliveryStatusPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {deliveryStatusOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`deliveryStatus.labels.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <OwnershipNoteField
            error={errors.deliveryInfo?.note}
            id="delivery-note"
            label={t("ownershipStatus.fields.note")}
            name="deliveryInfo.note"
            placeholder={t("ownershipStatus.fields.notePlaceholder")}
            register={register}
          />

          {mode === "edit" ? (
            <Button
              className="self-start"
              onClick={() =>
                setValue("ownershipStatus", "owned", { shouldDirty: true, shouldValidate: true })
              }
              type="button"
              variant="secondary"
            >
              <UiIcon name="check" size={16} />
              {t("deliveryInfo.markReceived")}
            </Button>
          ) : null}
        </div>
      ) : null}

      {ownershipUsesLoan(status) ? (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-secondary/40 p-4 motion-safe:animate-in motion-safe:duration-300 motion-safe:slide-in-from-top-1">
          <p className="text-sm font-medium text-foreground">{t("loanInfo.title")}</p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="loan-person-name">{t("loanInfo.fields.personName")}</Label>
            <Input
              aria-describedby={errors.loanInfo?.personName ? "loan-person-name-error" : undefined}
              aria-invalid={errors.loanInfo?.personName !== undefined}
              autoComplete="off"
              className="h-10"
              id="loan-person-name"
              placeholder={t("loanInfo.fields.personNamePlaceholder")}
              {...register("loanInfo.personName", { setValueAs: emptyToUndefined })}
            />
            <FieldError error={errors.loanInfo?.personName} id="loan-person-name-error" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="loan-date">{t("loanInfo.fields.loanDate")}</Label>
              <Controller
                control={control}
                name="loanInfo.loanDate"
                render={({ field }) => (
                  <BookDateField
                    ariaLabel={t("loanInfo.fields.loanDate")}
                    describedBy={errors.loanInfo?.loanDate ? "loan-date-error" : undefined}
                    id="loan-date"
                    invalid={errors.loanInfo?.loanDate !== undefined}
                    onChange={field.onChange}
                    placeholder={t("ownershipStatus.fields.datePlaceholder")}
                    value={field.value}
                  />
                )}
              />
              <FieldError error={errors.loanInfo?.loanDate} id="loan-date-error" />
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="loan-return-date">{t("loanInfo.fields.expectedReturnDate")}</Label>
              <Controller
                control={control}
                name="loanInfo.expectedReturnDate"
                render={({ field }) => (
                  <BookDateField
                    allowFuture
                    ariaLabel={t("loanInfo.fields.expectedReturnDate")}
                    describedBy={
                      errors.loanInfo?.expectedReturnDate ? "loan-return-date-error" : undefined
                    }
                    id="loan-return-date"
                    invalid={errors.loanInfo?.expectedReturnDate !== undefined}
                    onChange={field.onChange}
                    placeholder={t("ownershipStatus.fields.datePlaceholder")}
                    value={field.value}
                  />
                )}
              />
              <FieldError error={errors.loanInfo?.expectedReturnDate} id="loan-return-date-error" />
            </div>
          </div>

          <OwnershipNoteField
            error={errors.loanInfo?.note}
            id="loan-note"
            label={t("ownershipStatus.fields.note")}
            name="loanInfo.note"
            placeholder={t("ownershipStatus.fields.notePlaceholder")}
            register={register}
          />
        </div>
      ) : null}
    </FormSection>
  );
}

function emptyToUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function OwnershipNoteField({
  error,
  id,
  label,
  name,
  placeholder,
  register,
}: OwnershipNoteFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        aria-invalid={error !== undefined}
        id={id}
        maxLength={300}
        placeholder={placeholder}
        {...register(name, { setValueAs: emptyToUndefined })}
      />
      {error?.message ? (
        <p className="text-xs text-destructive" id={`${id}-error`} role="alert">
          {error.message}
        </p>
      ) : null}
    </div>
  );
}
