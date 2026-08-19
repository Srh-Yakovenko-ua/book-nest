"use client";

import type { BookOrderView, Currency, Nullable } from "@app/shared";
import type { FormEvent, ReactNode } from "react";

import { ORDER_FINANCIAL_MESSAGES, validateOrderInvariant } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
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
import { BookDateField } from "@/features/books/components/book-date-field";
import { StoreAutocomplete } from "@/features/books/components/store-autocomplete";
import { useDeliveryErrorText } from "@/features/books/hooks/use-delivery-error-text";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";

import type { DeliveryOrderCardModel } from "../model/order-card-model";

import { useBookOrder } from "../api/use-book-order";
import { useUpdateOrder } from "../api/use-order-shipment-actions";
import { formatMoney } from "../model/money-format";
import { DeliveryLoadingDialog } from "./delivery-loading-dialog";
import {
  Field,
  Footer,
  Frame,
  Labeled,
  mutationCallbacks,
  NOTE_MAX_LENGTH,
} from "./order-dialog-parts";

const CURRENCIES = ["UAH", "EUR", "USD"] as const satisfies readonly Currency[];
const MONEY_STEP = "1";
const COST_ERROR_KEY = {
  [ORDER_FINANCIAL_MESSAGES.currencyRequired]: "currencyRequired",
  [ORDER_FINANCIAL_MESSAGES.freeOrderCarriesAmounts]: "freeWithAmounts",
  [ORDER_FINANCIAL_MESSAGES.mismatch]: "negativeAmount",
  [ORDER_FINANCIAL_MESSAGES.negativeAmount]: "negativeAmount",
  [ORDER_FINANCIAL_MESSAGES.negativeTotal]: "negativeTotal",
  [ORDER_FINANCIAL_MESSAGES.paidOrderNeedsPositiveTotal]: "positiveTotal",
  [ORDER_FINANCIAL_MESSAGES.unknownTotal]: "totalRequired",
} as const;

export function EditOrderDialog({
  onOpenChange,
  order,
}: {
  onOpenChange: (open: boolean) => void;
  order: DeliveryOrderCardModel;
}) {
  const t = useTranslations("delivery.manage");
  const tErrors = useTranslations("books.details.delivery.errors");
  const { data, isError } = useBookOrder(order.id);

  if (data === undefined) {
    return (
      <DeliveryLoadingDialog
        className="sm:max-w-lg"
        description={t("editOrderDescription")}
        errorText={tErrors("generic")}
        isError={isError}
        onOpenChange={onOpenChange}
        open
        title={t("editOrder")}
      />
    );
  }

  return <EditOrderForm onOpenChange={onOpenChange} order={data} />;
}

function EditOrderForm({
  onOpenChange,
  order,
}: {
  onOpenChange: (open: boolean) => void;
  order: BookOrderView;
}) {
  const t = useTranslations("delivery.manage");
  const locale = useLocale();
  const deliveryErrorText = useDeliveryErrorText();
  const mutation = useUpdateOrder(order.id);

  const [storeName, setStoreName] = useState(order.storeName);
  const [orderNumber, setOrderNumber] = useState(order.orderNumber ?? "");
  const [orderDate, setOrderDate] = useState(order.orderDate ?? "");
  const [note, setNote] = useState(order.note ?? "");
  const [currency, setCurrency] = useState<"" | Currency>(order.currency ?? "");
  const [deliveryPrice, setDeliveryPrice] = useState(moneyText(order.deliveryPrice));
  const [discount, setDiscount] = useState(moneyText(order.discount));
  const [isFree, setIsFree] = useState(order.isFree);
  const [totalAmount, setTotalAmount] = useState(moneyText(order.totalAmount));

  const itemPrices = isFree ? [] : order.items.map((item) => item.price);
  const isTotalCalculated = itemPrices.length > 0 && itemPrices.every((price) => price !== null);
  const submittedTotalAmount = isFree || isTotalCalculated ? null : optionalMoney(totalAmount);
  const check = validateOrderInvariant({
    currency: currency === "" ? null : currency,
    deliveryPrice: isFree ? null : optionalMoney(deliveryPrice),
    discount: isFree ? null : optionalMoney(discount),
    isFree,
    itemPrices,
    totalAmount: submittedTotalAmount,
  });
  const financials = check.summary;
  const trimmedStoreName = storeName.trim();
  const costError = check.error === null ? null : t(COST_ERROR_KEY[check.error]);

  function toggleFree(next: boolean) {
    setIsFree(next);
    if (!next) return;
    setDeliveryPrice("");
    setDiscount("");
    setTotalAmount("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (trimmedStoreName === "" || costError !== null) return;
    if (currency === "") return;
    mutation.mutate(
      {
        currency,
        deliveryPrice: isFree ? null : optionalMoney(deliveryPrice),
        discount: isFree ? null : optionalMoney(discount),
        isFree,
        note: note.trim() || null,
        orderDate: orderDate || null,
        orderNumber: orderNumber.trim() || null,
        storeName: trimmedStoreName,
        ...(isFree || isTotalCalculated ? {} : { totalAmount: submittedTotalAmount }),
      },
      mutationCallbacks(t("orderUpdated"), deliveryErrorText, onOpenChange),
    );
  }

  return (
    <Frame
      className="max-h-[92vh] overflow-y-auto sm:max-w-lg"
      description={t("editOrderDescription")}
      onOpenChange={onOpenChange}
      title={t("editOrder")}
    >
      <form className="grid gap-5" noValidate onSubmit={submit}>
        <Group title={t("orderSection")}>
          <Labeled htmlFor="edit-order-store" label={t("store")}>
            <StoreAutocomplete
              id="edit-order-store"
              invalid={trimmedStoreName === ""}
              label={t("store")}
              onChange={setStoreName}
              placeholder={t("storePlaceholder")}
              value={storeName}
            />
          </Labeled>
          <Field label={t("orderNumber")} onChange={setOrderNumber} value={orderNumber} />
          <Labeled htmlFor="edit-order-date" label={t("orderDate")}>
            <BookDateField
              ariaLabel={t("orderDate")}
              id="edit-order-date"
              onChange={(next) => setOrderDate(next ?? "")}
              value={orderDate}
            />
          </Labeled>
          <Labeled htmlFor="edit-order-note" label={t("note")}>
            <Textarea
              id="edit-order-note"
              maxLength={NOTE_MAX_LENGTH}
              onChange={(event) => setNote(event.target.value)}
              value={note}
            />
          </Labeled>
        </Group>

        <Group title={t("costSection")}>
          <Label className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 font-normal">
            <Checkbox
              checked={isFree}
              className="mt-0.5"
              onCheckedChange={(checked) => toggleFree(checked === true)}
            />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium text-ink">{t("free")}</span>
              <span className="text-xs text-muted-foreground">{t("freeHint")}</span>
            </span>
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled htmlFor="edit-order-currency" label={t("currency")}>
              <Select onValueChange={(value) => setCurrency(value as Currency)} value={currency}>
                <SelectTrigger className="w-full" id="edit-order-currency">
                  <SelectValue placeholder={t("currencyPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Labeled>
            {isFree || isTotalCalculated ? null : (
              <MoneyField
                id="edit-order-total"
                label={t("total")}
                onChange={setTotalAmount}
                value={totalAmount}
              />
            )}
            {isFree ? null : (
              <>
                <MoneyField
                  id="edit-order-delivery-price"
                  label={t("deliveryPrice")}
                  onChange={setDeliveryPrice}
                  value={deliveryPrice}
                />
                <MoneyField
                  id="edit-order-discount"
                  label={t("discount")}
                  onChange={setDiscount}
                  value={discount}
                />
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isFree
              ? t("freeSummary")
              : isTotalCalculated
                ? t("calculatedTotalHint")
                : t("manualTotalHint")}
          </p>
          {!isFree && isTotalCalculated ? (
            <div className="grid gap-1.5 rounded-lg bg-secondary/30 px-3 py-2.5 text-sm">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {t("summary")}
              </p>
              <SummaryRow
                label={t("itemsSubtotal")}
                value={formatMoney({
                  amount: financials.itemsSubtotal,
                  currency: currency === "" ? null : currency,
                  locale,
                })}
              />
              <SummaryRow
                label={t("deliverySummary")}
                value={formatMoney({
                  amount: financials.deliveryPrice,
                  currency: currency === "" ? null : currency,
                  locale,
                })}
              />
              <SummaryRow
                label={t("discountSummary")}
                value={formatMoney({
                  amount: financials.discount,
                  currency: currency === "" ? null : currency,
                  locale,
                })}
              />
              <div className="mt-1 flex items-baseline justify-between gap-4 border-t border-border pt-2">
                <span className="font-semibold text-ink">{t("paidTotal")}</span>
                <span className="font-heading text-lg font-semibold text-ink tabular-nums">
                  {formatMoney({
                    amount: financials.effectiveTotalAmount ?? 0,
                    currency: currency === "" ? null : currency,
                    locale,
                  })}
                </span>
              </div>
            </div>
          ) : null}
        </Group>

        {costError === null ? null : (
          <p className="text-sm text-destructive" role="alert">
            {costError}
          </p>
        )}
        <Footer loading={mutation.isPending} t={t} />
      </form>
    </Frame>
  );
}

function Group({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="grid gap-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function MoneyField({
  id,
  label,
  onChange,
  value,
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Labeled htmlFor={id} label={label}>
      <Input
        id={id}
        inputMode="decimal"
        min="0"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={blockNegativeNumberKeys}
        onPaste={blockNegativeNumberPaste}
        step={MONEY_STEP}
        type="number"
        value={value}
      />
    </Labeled>
  );
}

function moneyText(amount: Nullable<number>): string {
  return amount === null ? "" : String(amount);
}

function optionalMoney(value: string): Nullable<number> {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-ink tabular-nums">{value}</span>
    </div>
  );
}
