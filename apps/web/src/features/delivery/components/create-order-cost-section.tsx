"use client";

import type { Currency, Nullable, OrderFinancialSummary } from "@app/shared";
import type { Dispatch } from "react";

import { useLocale, useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  type CreateBookOrderDraftAction,
  type FinancialMode,
  optionalNumber,
  type OrderDraft,
} from "../model/create-book-order-draft";
import { formatMoney } from "../model/money-format";
import { Field, FormSection, MoneyField } from "./create-order-form-parts";

const CURRENCIES = ["UAH", "EUR", "USD"] as const satisfies readonly Currency[];

export function CreateOrderCostSection({
  currency,
  dispatch,
  financialError,
  financialMode,
  financials,
  order,
}: {
  currency: Currency;
  dispatch: Dispatch<CreateBookOrderDraftAction>;
  financialError: Nullable<string>;
  financialMode: FinancialMode;
  financials: OrderFinancialSummary;
  order: OrderDraft;
}) {
  const t = useTranslations("delivery.createOrder");
  const locale = useLocale();
  const manualDeliveryPrice = optionalNumber(order.deliveryPrice);
  const manualDiscount = optionalNumber(order.discount);
  const manualTotalAmount = optionalNumber(order.totalAmount);
  const hasManualSummary =
    manualTotalAmount !== null || manualDeliveryPrice !== null || manualDiscount !== null;
  const remainingItemPricesCount = financials.itemsCount - financials.pricedItemsCount;

  function changeFinancialMode(value: string) {
    dispatch({ mode: value === "items" ? "items" : "total", type: "financialModeChanged" });
  }

  return (
    <FormSection description={t("cost.description")} icon="wallet" title={t("cost.title")}>
      <div className="flex flex-col gap-4">
        <Label className="flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 font-normal">
          <Checkbox
            checked={order.isFree}
            className="mt-0.5"
            onCheckedChange={(checked) =>
              dispatch({ isFree: checked === true, type: "freeChanged" })
            }
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium text-ink">{t("order.free")}</span>
            <span className="text-xs text-muted-foreground">{t("order.freeHint")}</span>
          </span>
        </Label>
        {order.isFree ? null : (
          <Segmented
            block
            label={t("cost.modeLabel")}
            onValueChange={changeFinancialMode}
            options={[
              { label: t("cost.modes.total"), value: "total" },
              { label: t("cost.modes.items"), value: "items" },
            ]}
            value={financialMode}
          />
        )}
        {order.isFree || financialMode !== "items" ? null : financialError === null ? (
          <div
            className="flex items-start gap-2 rounded-md border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info"
            role="status"
          >
            <UiIcon aria-hidden className="mt-px shrink-0" name="info" size={14} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">
                {financials.isItemBreakdownComplete
                  ? t("cost.itemPricesCompleteTitle")
                  : t("cost.itemPricesProgressTitle", {
                      itemsCount: financials.itemsCount,
                      pricedItemsCount: financials.pricedItemsCount,
                    })}
              </span>
              <span>
                {financials.isItemBreakdownComplete
                  ? t("cost.itemPricesCompleteDescription")
                  : financials.pricedItemsCount === 0
                    ? t("cost.itemPricesEmptyDescription")
                    : t("cost.itemPricesRemainingDescription", {
                        count: remainingItemPricesCount,
                      })}
              </span>
            </span>
          </div>
        ) : (
          <div
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            role="alert"
          >
            <UiIcon aria-hidden className="mt-px shrink-0" name="alert-triangle" size={14} />
            <span className="min-w-0">{financialError}</span>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-12 sm:gap-x-3">
          {!order.isFree && financialMode === "total" ? (
            <div className="flex flex-col gap-2 sm:col-span-9">
              <MoneyField
                hideSteppers
                label={t("order.total")}
                onChange={(value) =>
                  dispatch({ field: "totalAmount", type: "orderFieldChanged", value })
                }
                required
                value={order.totalAmount}
              />
              <p className="text-xs text-muted-foreground">{t("cost.totalHint")}</p>
            </div>
          ) : null}
          <Field
            className={
              order.isFree
                ? "sm:col-span-4"
                : financialMode === "total"
                  ? "sm:col-span-3"
                  : "sm:col-span-4"
            }
            label={t("order.currency")}
            required
          >
            <Select
              onValueChange={(value) =>
                dispatch({ field: "currency", type: "orderFieldChanged", value: value as Currency })
              }
              value={order.currency}
            >
              <SelectTrigger className="h-10 data-[size=default]:h-10">
                <SelectValue placeholder={t("order.currencyPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem key={currency} value={currency}>
                    {currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {!order.isFree && financialMode === "total" ? (
            <p className="-mb-2 text-xs font-medium text-muted-foreground sm:col-span-12">
              {t("cost.breakdownOptional")}
            </p>
          ) : null}
          {order.isFree ? null : (
            <>
              <MoneyField
                className={financialMode === "total" ? "sm:col-span-6" : "sm:col-span-4"}
                label={t("order.deliveryPrice")}
                onChange={(value) =>
                  dispatch({ field: "deliveryPrice", type: "orderFieldChanged", value })
                }
                optional
                value={order.deliveryPrice}
              />
              <MoneyField
                className={financialMode === "total" ? "sm:col-span-6" : "sm:col-span-4"}
                label={t("order.discount")}
                onChange={(value) =>
                  dispatch({ field: "discount", type: "orderFieldChanged", value })
                }
                optional
                value={order.discount}
              />
            </>
          )}
        </div>
        {order.isFree ? (
          <p className="rounded-lg bg-secondary/30 px-3 py-2.5 text-sm text-muted-foreground">
            {t("cost.freeSummary")}
          </p>
        ) : null}
        {!order.isFree && financialMode === "total" && hasManualSummary ? (
          <div className="grid gap-1.5 rounded-lg bg-secondary/30 px-3 py-2.5 text-sm">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {t("cost.summary")}
            </p>
            {manualTotalAmount === null ? null : (
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-semibold text-ink">{t("cost.paidTotal")}</span>
                <span className="font-heading text-lg font-semibold text-ink tabular-nums">
                  {formatMoney({ amount: manualTotalAmount, currency, locale })}
                </span>
              </div>
            )}
            {manualDeliveryPrice === null ? null : (
              <FinancialRow
                label={t("cost.deliverySummary")}
                value={formatMoney({ amount: manualDeliveryPrice, currency, locale })}
              />
            )}
            {manualDiscount === null ? null : (
              <FinancialRow
                label={t("cost.discountSummary")}
                value={formatMoney({ amount: manualDiscount, currency, locale })}
              />
            )}
          </div>
        ) : null}
        {!order.isFree && financialMode === "items" ? (
          financials.isItemBreakdownComplete ? (
            <div className="grid gap-1.5 rounded-lg bg-secondary/30 px-3 py-2.5 text-sm">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {t("cost.summary")}
              </p>
              <FinancialRow
                label={t("order.itemsSubtotal")}
                value={formatMoney({ amount: financials.itemsSubtotal, currency, locale })}
              />
              {manualDeliveryPrice === null ? null : (
                <FinancialRow
                  label={t("cost.deliverySummary")}
                  value={formatMoney({ amount: manualDeliveryPrice, currency, locale })}
                />
              )}
              {manualDiscount === null ? null : (
                <FinancialRow
                  label={t("cost.discountSummary")}
                  value={formatMoney({ amount: manualDiscount, currency, locale })}
                />
              )}
              <div className="mt-1 border-t border-border pt-2">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-semibold text-ink">{t("cost.paidTotal")}</span>
                  <span className="font-heading text-lg font-semibold text-ink tabular-nums">
                    {formatMoney({
                      amount: financials.effectiveTotalAmount ?? 0,
                      currency,
                      locale,
                    })}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-1.5 rounded-lg bg-secondary/30 px-3 py-2.5 text-sm">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {t("cost.summary")}
              </p>
              <p className="text-sm text-muted-foreground">{t("cost.summaryPending")}</p>
              <p className="text-xs text-muted-foreground">{t("cost.summaryFormula")}</p>
            </div>
          )
        ) : null}
      </div>
    </FormSection>
  );
}

function FinancialRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-ink tabular-nums">{value}</span>
    </div>
  );
}
