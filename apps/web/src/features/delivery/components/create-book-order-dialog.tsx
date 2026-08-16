"use client";

import type { BookView, Currency, OwnershipStatus } from "@app/shared";
import type { ReactNode } from "react";

import { CreateBookOrderInputSchema, resolveOrderFinancials } from "@app/shared";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon, type UiIconName } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { BookDateField } from "@/features/books/components/book-date-field";
import { BookMultiSelectPicker } from "@/features/books/components/book-multi-select-picker";
import { BookThumb } from "@/features/books/components/book-picker";
import { DeliveryServiceAutocomplete } from "@/features/books/components/delivery-service-autocomplete";
import { StoreAutocomplete } from "@/features/books/components/store-autocomplete";
import {
  blockNegativeNumberKeys,
  blockNegativeNumberPaste,
} from "@/lib/block-negative-number-keys";
import { ApiError } from "@/lib/http-client";

import { useCreateBookOrder } from "../api/use-create-book-order";
import {
  createEmptyShipment,
  EMPTY_ORDER,
  type OrderDraft,
  type ShipmentDraft,
  toCreateBookOrderInput,
} from "../model/create-book-order-draft";
import { formatMoney } from "../model/money-format";
const CURRENCIES = ["UAH", "EUR", "USD"] as const satisfies readonly Currency[];
const ORDER_PICKER_OWNERSHIP_STATUSES = [
  "none",
  "want_to_buy",
  "in_transit",
] as const satisfies readonly OwnershipStatus[];
type CreateOrderView = "books" | "form";
type FinancialMode = "items" | "total";

type OrderBookDraft = { book: BookView; price: string };
export function CreateBookOrderDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [view, setView] = useState<CreateOrderView>("form");

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) setView("form");
    onOpenChange(nextOpen);
  }

  return (
    <Dialog onOpenChange={changeOpen} open={open}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <div className="grid w-full gap-4">
          {open ? (
            <CreateBookOrderForm
              onDone={() => changeOpen(false)}
              onViewChange={setView}
              view={view}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BookPickerView({
  onBack,
  onDone,
  onSelectedChange,
  selected,
}: {
  onBack: () => void;
  onDone: () => void;
  onSelectedChange: (books: BookView[]) => void;
  selected: BookView[];
}) {
  const t = useTranslations("delivery.createOrder.bookPicker");
  return (
    <>
      <DialogHeader>
        <Button className="w-fit" onClick={onBack} size="sm" variant="ghost">
          <UiIcon name="arrow-left" size={16} />
          {t("back")}
        </Button>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>
      <BookMultiSelectPicker
        baseParams={{ owner: [...ORDER_PICKER_OWNERSHIP_STATUSES] }}
        isVisible={(book) => book.delivery.active === null}
        labels={{
          clear: t("clear"),
          disabled: t("activeOrder"),
          empty: t("empty"),
          emptySelected: t("emptySelected"),
          library: t("library"),
          loadMore: t("loadMore"),
          removeSelected: t("removeSelected"),
          search: t("search"),
          selected: (count) => t("selected", { count }),
          selectLoaded: (count) => t("selectLoaded", { count }),
        }}
        onSelectedChange={onSelectedChange}
        selected={selected}
      />
      <DialogFooter>
        <Button className="sm:min-w-32" onClick={onDone}>
          {t("applySelection")}
        </Button>
      </DialogFooter>
    </>
  );
}

function CreateBookOrderForm({
  onDone,
  onViewChange,
  view,
}: {
  onDone: () => void;
  onViewChange: (view: CreateOrderView) => void;
  view: CreateOrderView;
}) {
  const t = useTranslations("delivery.createOrder");
  const locale = useLocale();
  const mutation = useCreateBookOrder();
  const [order, setOrder] = useState<OrderDraft>(EMPTY_ORDER);
  const [books, setBooks] = useState<OrderBookDraft[]>([]);
  const [shipments, setShipments] = useState<ShipmentDraft[]>([]);
  const [pickerSelection, setPickerSelection] = useState<BookView[]>([]);
  const [financialMode, setFinancialMode] = useState<FinancialMode>("total");
  const [shipping, setShipping] = useState<"no" | "yes">("no");
  const [shipmentToRemoveId, setShipmentToRemoveId] = useState<null | string>(null);
  const [validationError, setValidationError] = useState<null | string>(null);
  const assignedIds = new Set(shipments.flatMap((shipment) => shipment.bookIds));
  const unassignedBooks = books.filter(({ book }) => !assignedIds.has(book.id));
  const primaryShipment = shipments[0];
  const shipmentToRemove = shipments.find(({ id }) => id === shipmentToRemoveId) ?? null;
  const shipmentToRemoveNumber = shipments.findIndex(({ id }) => id === shipmentToRemoveId) + 1;
  const isSimpleShipmentMode =
    shipping === "yes" && shipments.length === 1 && unassignedBooks.length === 0;
  const isDistributionMode =
    shipping === "yes" &&
    (shipments.length > 1 || (shipments.length === 1 && unassignedBooks.length > 0));
  const financials = resolveOrderFinancials({
    deliveryPrice: optionalMoney(order.deliveryPrice),
    discount: optionalMoney(order.discount),
    itemPrices: books.map(({ price }) => optionalMoney(price)),
    totalAmount: optionalMoney(order.totalAmount),
  });
  const currency = order.currency === "" ? "UAH" : order.currency;
  const manualDeliveryPrice = optionalMoney(order.deliveryPrice);
  const manualDiscount = optionalMoney(order.discount);
  const manualTotalAmount = optionalMoney(order.totalAmount);
  const hasManualSummary =
    manualTotalAmount !== null || manualDeliveryPrice !== null || manualDiscount !== null;
  const remainingItemPricesCount = financials.itemsCount - financials.pricedItemsCount;

  function updateOrder<K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) {
    setOrder((current) => ({ ...current, [key]: value }));
  }

  function removeBook(bookId: string) {
    const nextBooks = books.filter(({ book }) => book.id !== bookId);
    clearManualTotalAfterCompleteBreakdown(nextBooks);
    setBooks(nextBooks);
    setShipments((current) =>
      current.map((shipment) => ({
        ...shipment,
        bookIds: shipment.bookIds.filter((id) => id !== bookId),
      })),
    );
  }

  function addShipment() {
    setShipments((current) => [...current, { ...createEmptyShipment(), status: "in_transit" }]);
  }

  function mergeIntoSingleShipment() {
    setShipments((current) =>
      current.map((shipment, index) =>
        index === 0 ? { ...shipment, bookIds: books.map(({ book }) => book.id) } : shipment,
      ),
    );
  }

  function removeShipment(shipmentId: string) {
    setShipments((current) => current.filter(({ id }) => id !== shipmentId));
    setShipmentToRemoveId(null);
  }

  function requestShipmentRemoval(shipment: ShipmentDraft) {
    if (shipments.length <= 1) return;
    if (shipment.bookIds.length === 0) {
      removeShipment(shipment.id);
      return;
    }
    setShipmentToRemoveId(shipment.id);
  }

  function startSplitShipping() {
    setShipments((current) => {
      const first: ShipmentDraft = current[0] ?? {
        ...createEmptyShipment(),
        status: "in_transit",
      };
      return [
        { ...first, bookIds: [] },
        { ...createEmptyShipment(), status: "in_transit" },
      ];
    });
  }

  function changeShipping(value: string) {
    if (value === "no") {
      setShipping("no");
      setShipments([]);
      return;
    }
    setShipping("yes");
    setShipments((current) =>
      current.length > 0
        ? current
        : [
            {
              ...createEmptyShipment(),
              bookIds: books.map(({ book }) => book.id),
              status: "in_transit",
            },
          ],
    );
  }

  function applySelectedBooks(selected: BookView[]) {
    const nextBooks = selected.map((book) => ({
      book,
      price: books.find((entry) => entry.book.id === book.id)?.price ?? "",
    }));
    clearManualTotalAfterCompleteBreakdown(nextBooks);
    setBooks(nextBooks);
    if (isSimpleShipmentMode) {
      setShipments((current) =>
        current.map((shipment, index) =>
          index === 0 ? { ...shipment, bookIds: selected.map(({ id }) => id) } : shipment,
        ),
      );
    }
  }

  function clearManualTotalAfterCompleteBreakdown(nextBooks: OrderBookDraft[]) {
    if (hasCompleteItemPrices(books) && !hasCompleteItemPrices(nextBooks)) {
      updateOrder("totalAmount", "");
    }
  }

  function updateBookPrice(bookId: string, price: string) {
    const nextBooks = books.map((item) => (item.book.id === bookId ? { ...item, price } : item));
    clearManualTotalAfterCompleteBreakdown(nextBooks);
    setBooks(nextBooks);
  }

  function changeFinancialMode(value: string) {
    if (value === "items") {
      setFinancialMode("items");
      updateOrder("totalAmount", "");
      return;
    }
    setFinancialMode("total");
    setBooks((current) => current.map((item) => ({ ...item, price: "" })));
  }

  function openBookPicker() {
    setPickerSelection(books.map(({ book }) => book));
    onViewChange("books");
  }

  function updateShipment(id: string, patch: Partial<ShipmentDraft>) {
    setShipments((current) =>
      current.map((shipment) => (shipment.id === id ? { ...shipment, ...patch } : shipment)),
    );
  }

  function toggleShipmentBook(shipmentId: string, bookId: string) {
    setShipments((current) =>
      current.map((shipment) => {
        if (shipment.id !== shipmentId) return shipment;
        return {
          ...shipment,
          bookIds: shipment.bookIds.includes(bookId)
            ? shipment.bookIds.filter((id) => id !== bookId)
            : [...shipment.bookIds, bookId],
        };
      }),
    );
  }

  function submit() {
    if (financialMode === "items" && !hasCompleteItemPrices(books)) {
      setValidationError(t("validation.itemPricesRequired"));
      return;
    }
    const parsed = CreateBookOrderInputSchema.safeParse(
      toCreateBookOrderInput({
        books: books.map(({ book, price }) => ({ bookId: book.id, price })),
        order,
        shipments,
      }),
    );
    if (!parsed.success) {
      setValidationError(t("validation.invalid"));
      return;
    }
    setValidationError(null);
    mutation.mutate(parsed.data, {
      onError: (error) => toast.error(error instanceof ApiError ? error.message : t("toast.error")),
      onSuccess: () => {
        toast.success(t("toast.success"));
        onDone();
      },
    });
  }

  if (view === "books") {
    return (
      <BookPickerView
        onBack={() => onViewChange("form")}
        onDone={() => {
          applySelectedBooks(pickerSelection);
          onViewChange("form");
        }}
        onSelectedChange={setPickerSelection}
        selected={pickerSelection}
      />
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-6">
        <FormSection description={t("order.description")} icon="cart" title={t("order.title")}>
          <div className="grid gap-4 sm:grid-cols-12">
            <Field className="sm:col-span-5" label={t("order.store")} required>
              <StoreAutocomplete
                id="order-store"
                invalid={false}
                label={t("order.store")}
                onChange={(value) => updateOrder("storeName", value)}
                placeholder={t("order.storePlaceholder")}
                value={order.storeName}
              />
            </Field>
            <TextField
              className="sm:col-span-3"
              label={t("order.number")}
              onChange={(value) => updateOrder("orderNumber", value)}
              optional
              value={order.orderNumber}
            />
            <DateField
              className="sm:col-span-4"
              id="order-date"
              label={t("order.date")}
              onChange={(value) => updateOrder("orderDate", value)}
              optional
              value={order.orderDate}
            />
          </div>
        </FormSection>

        <FormSection description={t("books.description")} icon="book" title={t("books.title")}>
          <div className="flex flex-col gap-3">
            {books.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {books.map((entry) => (
                  <li
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3 sm:flex-nowrap"
                    key={entry.book.id}
                  >
                    <BookThumb book={entry.book} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{entry.book.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {entry.book.authors.map((author) => author.name).join(", ")}
                      </p>
                    </div>
                    {financialMode === "items" ? (
                      <div className="order-last ml-12 flex items-center gap-2 sm:order-none sm:ml-0">
                        <Input
                          aria-label={t("books.priceFor", { title: entry.book.title })}
                          aria-required
                          className="h-10 w-20"
                          inputMode="decimal"
                          min="0"
                          onChange={(event) => updateBookPrice(entry.book.id, event.target.value)}
                          onKeyDown={blockNegativeNumberKeys}
                          onPaste={blockNegativeNumberPaste}
                          placeholder={t("books.price")}
                          type="number"
                          value={entry.price}
                        />
                        <span className="text-sm text-muted-foreground">{currency}</span>
                      </div>
                    ) : null}
                    <Button
                      aria-label={t("books.remove", { title: entry.book.title })}
                      onClick={() => removeBook(entry.book.id)}
                      size="icon-sm"
                      variant="ghost"
                    >
                      <UiIcon name="trash" size={16} />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button className="self-start" onClick={openBookPicker} variant="outline">
              <UiIcon name="plus" size={16} />
              {t("books.add")}
            </Button>
          </div>
        </FormSection>

        <FormSection description={t("cost.description")} icon="wallet" title={t("cost.title")}>
          <div className="flex flex-col gap-4">
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
            {financialMode === "items" ? (
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
            ) : null}
            <div className="grid gap-4 sm:grid-cols-12 sm:gap-x-3">
              {financialMode === "total" ? (
                <div className="flex flex-col gap-2 sm:col-span-9">
                  <MoneyField
                    hideSteppers
                    label={t("order.total")}
                    onChange={(value) => updateOrder("totalAmount", value)}
                    optional
                    value={order.totalAmount}
                  />
                  <p className="text-xs text-muted-foreground">{t("cost.totalHint")}</p>
                </div>
              ) : null}
              <Field
                className={financialMode === "total" ? "sm:col-span-3" : "sm:col-span-4"}
                label={t("order.currency")}
              >
                <Select
                  onValueChange={(value) => updateOrder("currency", value as Currency)}
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
              {financialMode === "total" ? (
                <p className="-mb-2 text-xs font-medium text-muted-foreground sm:col-span-12">
                  {t("cost.breakdownOptional")}
                </p>
              ) : null}
              <MoneyField
                className={financialMode === "total" ? "sm:col-span-6" : "sm:col-span-4"}
                label={t("order.deliveryPrice")}
                onChange={(value) => updateOrder("deliveryPrice", value)}
                optional
                value={order.deliveryPrice}
              />
              <MoneyField
                className={financialMode === "total" ? "sm:col-span-6" : "sm:col-span-4"}
                label={t("order.discount")}
                onChange={(value) => updateOrder("discount", value)}
                optional
                value={order.discount}
              />
            </div>
            {financialMode === "total" && hasManualSummary ? (
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
            {financialMode === "items" ? (
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

        <FormSection
          description={t("shipments.description")}
          icon="truck"
          title={t("shipments.title")}
        >
          <div className="flex flex-col gap-4">
            <Field label={t("shipments.shippedQuestion")}>
              <Segmented
                block
                label={t("shipments.shippedQuestion")}
                onValueChange={changeShipping}
                options={[
                  { label: t("shipments.shippedOptions.no"), value: "no" },
                  { label: t("shipments.shippedOptions.yes"), value: "yes" },
                ]}
                value={shipping}
              />
            </Field>
            {shipping === "no" ? (
              <div
                className="flex items-start gap-2 rounded-md border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info"
                role="status"
              >
                <UiIcon aria-hidden className="mt-px shrink-0" name="info" size={14} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="font-medium">{t("shipments.awaiting")}</p>
                  <p>{t("shipments.awaitingHint")}</p>
                </div>
              </div>
            ) : null}
            {isSimpleShipmentMode && primaryShipment ? (
              <>
                <ShipmentSection
                  assignedIds={assignedIds}
                  books={books.map(({ book }) => book)}
                  index={0}
                  onRemove={() => undefined}
                  onToggleBook={() => undefined}
                  onUpdate={(patch) => updateShipment(primaryShipment.id, patch)}
                  shipment={primaryShipment}
                  showBooks={false}
                />
                <div
                  className="flex items-start gap-2 rounded-md border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info"
                  role="status"
                >
                  <UiIcon aria-hidden className="mt-px shrink-0" name="info" size={14} />
                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-0.5">
                      <p className="font-medium">{t("shipments.splitQuestion")}</p>
                      <p>{t("shipments.splitHint")}</p>
                    </div>
                    <Button
                      className="self-start sm:self-auto"
                      onClick={startSplitShipping}
                      size="sm"
                      variant="tonal"
                    >
                      {t("shipments.split")}
                    </Button>
                  </div>
                </div>
              </>
            ) : null}
            {isDistributionMode ? (
              <>
                <DistributionStatus
                  books={unassignedBooks.map(({ book }) => book)}
                  onMerge={shipments.length === 1 ? mergeIntoSingleShipment : undefined}
                />
                {shipments.map((shipment, index) => (
                  <ShipmentSection
                    assignedIds={assignedIds}
                    books={books.map(({ book }) => book)}
                    canRemove={shipments.length > 1}
                    index={index}
                    key={shipment.id}
                    onRemove={() => requestShipmentRemoval(shipment)}
                    onToggleBook={(bookId) => toggleShipmentBook(shipment.id, bookId)}
                    onUpdate={(patch) => updateShipment(shipment.id, patch)}
                    shipment={shipment}
                    showBooks
                  />
                ))}
                <Button
                  className="self-start"
                  disabled={books.length === 0}
                  onClick={addShipment}
                  variant="outline"
                >
                  <UiIcon name="plus" size={16} />
                  {t("shipments.addAnother")}
                </Button>
              </>
            ) : null}
          </div>
        </FormSection>

        <Field htmlFor="order-note" label={t("order.note")} optional>
          <Textarea
            id="order-note"
            onChange={(event) => updateOrder("note", event.target.value)}
            value={order.note}
          />
        </Field>
      </div>

      {validationError ? (
        <p className="text-sm text-destructive" role="alert">
          {validationError}
        </p>
      ) : null}
      <DialogFooter>
        <Button disabled={mutation.isPending} onClick={onDone} variant="outline">
          {t("cancel")}
        </Button>
        <Button disabled={mutation.isPending} loading={mutation.isPending} onClick={submit}>
          {t("submit")}
        </Button>
      </DialogFooter>
      <AlertDialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setShipmentToRemoveId(null);
        }}
        open={shipmentToRemove !== null}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <UiIcon name="trash" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {t("shipments.removeConfirmTitle", { number: shipmentToRemoveNumber })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("shipments.removeConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("shipments.removeConfirmCancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClickCapture={() => {
                if (shipmentToRemove !== null) removeShipment(shipmentToRemove.id);
              }}
              variant="destructive"
            >
              {t("shipments.removeConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DateField({
  allowFuture,
  className,
  disablePast,
  id,
  label,
  onChange,
  optional,
  value,
}: {
  allowFuture?: boolean;
  className?: string;
  disablePast?: boolean;
  id: string;
  label: string;
  onChange: (value: string) => void;
  optional?: boolean;
  value: string;
}) {
  return (
    <Field className={className} label={label} optional={optional}>
      <BookDateField
        allowFuture={allowFuture}
        ariaLabel={label}
        className="h-10"
        disablePast={disablePast}
        id={id}
        onChange={(next) => onChange(next ?? "")}
        value={value}
      />
    </Field>
  );
}

function DistributionStatus({ books, onMerge }: { books: BookView[]; onMerge?: () => void }) {
  const t = useTranslations("delivery.createOrder.shipments");
  const isComplete = books.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <div
        className={
          isComplete
            ? "flex items-start gap-2 rounded-md border border-success/30 bg-success-soft/60 px-3 py-2 text-xs text-success"
            : "flex items-start gap-2 rounded-md border border-info/30 bg-info-soft/60 px-3 py-2 text-xs text-info"
        }
        role="status"
      >
        <UiIcon
          aria-hidden
          className="mt-px shrink-0"
          name={isComplete ? "check" : "info"}
          size={14}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="font-medium">{isComplete ? t("allDistributed") : t("unassignedTitle")}</p>
          <p>
            {isComplete ? t("allDistributedHint") : t("unassignedCount", { count: books.length })}
          </p>
          {isComplete ? null : <p>{t("distributionHint")}</p>}
        </div>
      </div>
      {onMerge === undefined ? null : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{t("mergeHint")}</p>
          <Button className="self-start sm:self-auto" onClick={onMerge} size="sm" variant="tonal">
            {t("mergeAll")}
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({
  children,
  className,
  htmlFor,
  label,
  required = false,
}: {
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  label: string;
  optional?: boolean;
  required?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div className="flex items-center gap-1">
        <Label htmlFor={htmlFor}>{label}</Label>
        {required ? (
          <span aria-hidden className="text-sm leading-none text-destructive">
            *
          </span>
        ) : null}
      </div>
      {children}
    </div>
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

function FormSection({
  children,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: UiIconName;
  title: string;
}) {
  return (
    <section className="flex flex-col gap-5 border-b border-border pb-6 last:border-b-0 last:pb-0">
      <header className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground">
          <UiIcon name={icon} size={18} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="font-heading text-base leading-tight font-semibold text-ink">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function hasCompleteItemPrices(books: OrderBookDraft[]): boolean {
  return books.length > 0 && books.every(({ price }) => price.trim() !== "");
}

function MoneyField({
  className,
  hideSteppers = false,
  label,
  onChange,
  optional,
  value,
}: {
  className?: string;
  hideSteppers?: boolean;
  label: string;
  onChange: (value: string) => void;
  optional?: boolean;
  value: string;
}) {
  return (
    <Field className={className} label={label} optional={optional}>
      <Input
        aria-label={label}
        className={
          hideSteppers
            ? "h-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            : "h-10"
        }
        inputMode="decimal"
        min="0"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={blockNegativeNumberKeys}
        onPaste={blockNegativeNumberPaste}
        step="0.01"
        type="number"
        value={value}
      />
    </Field>
  );
}

function optionalMoney(value: string): null | number {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

function ShipmentSection({
  assignedIds,
  books,
  canRemove,
  index,
  onRemove,
  onToggleBook,
  onUpdate,
  shipment,
  showBooks,
}: {
  assignedIds: ReadonlySet<string>;
  books: BookView[];
  canRemove?: boolean;
  index: number;
  onRemove: () => void;
  onToggleBook: (bookId: string) => void;
  onUpdate: (patch: Partial<ShipmentDraft>) => void;
  shipment: ShipmentDraft;
  showBooks: boolean;
}) {
  const t = useTranslations("delivery.createOrder.shipments");
  const [additionalOpen, setAdditionalOpen] = useState(false);
  const [bookSelectionOpen, setBookSelectionOpen] = useState(false);
  const shipmentBooks = books.filter((book) => shipment.bookIds.includes(book.id));
  const selectableBooks = books.filter(
    (book) => shipment.bookIds.includes(book.id) || !assignedIds.has(book.id),
  );
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-medium text-ink">
          {showBooks ? t("shipment", { number: index + 1 }) : t("singleShipment")}
        </h4>
        {showBooks ? (
          <Badge className="mr-auto" variant="secondary">
            {t("bookCount", { count: shipmentBooks.length })}
          </Badge>
        ) : null}
        {showBooks && canRemove === true ? (
          <Button
            aria-label={t("remove", { number: index + 1 })}
            onClick={onRemove}
            size="icon-sm"
            variant="ghost"
          >
            <UiIcon name="trash" size={16} />
          </Button>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("service")} optional>
          <DeliveryServiceAutocomplete
            id={`shipment-service-${shipment.id}`}
            invalid={false}
            label={t("service")}
            onChange={(deliveryService) => onUpdate({ deliveryService })}
            placeholder={t("servicePlaceholder")}
            value={shipment.deliveryService}
          />
        </Field>
        <TextField
          label={t("trackingNumber")}
          onChange={(trackingNumber) => onUpdate({ trackingNumber })}
          optional
          value={shipment.trackingNumber}
        />
        <DateField
          allowFuture
          disablePast
          id={`shipment-expected-date-${shipment.id}`}
          label={t("expectedDate")}
          onChange={(expectedDeliveryDate) => onUpdate({ expectedDeliveryDate })}
          optional
          value={shipment.expectedDeliveryDate}
        />
        <Collapsible
          className="flex flex-col gap-4 sm:col-span-2"
          onOpenChange={setAdditionalOpen}
          open={additionalOpen}
        >
          <CollapsibleTrigger className="group flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm font-medium text-ink transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
            {t("additional")}
            <UiIcon
              className="text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
              name="chevron-down"
              size={16}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-4">
            <TextField
              label={t("trackingUrl")}
              onChange={(trackingUrl) => onUpdate({ trackingUrl })}
              optional
              type="url"
              value={shipment.trackingUrl}
            />
            <Field label={t("note")} optional>
              <Textarea
                onChange={(event) => onUpdate({ note: event.target.value })}
                value={shipment.note}
              />
            </Field>
          </CollapsibleContent>
        </Collapsible>
      </div>
      {showBooks ? (
        bookSelectionOpen ? (
          <fieldset className="flex flex-col gap-3 border-t border-border pt-4">
            <legend className="px-1 text-sm font-medium text-ink">{t("selectBooks")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {selectableBooks.map((book) => (
                <label className="flex cursor-pointer items-center gap-2" key={book.id}>
                  <Checkbox
                    checked={shipment.bookIds.includes(book.id)}
                    onCheckedChange={() => onToggleBook(book.id)}
                  />
                  <span className="text-sm">{book.title}</span>
                </label>
              ))}
            </div>
            <Button className="self-end" onClick={() => setBookSelectionOpen(false)} size="sm">
              {t("doneSelectingBooks")}
            </Button>
          </fieldset>
        ) : shipmentBooks.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-ink">
              {t("inShipment", { count: shipmentBooks.length })}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {shipmentBooks.map((book) => (
                <Badge key={book.id} variant="secondary">
                  <UiIcon name="book" size={12} />
                  {book.title}
                </Badge>
              ))}
            </div>
            <Button
              className="self-end"
              onClick={() => setBookSelectionOpen(true)}
              size="sm"
              variant="outline"
            >
              <UiIcon name="edit" size={14} />
              {t("editBooks")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-ink">{t("emptyShipment")}</p>
              <p className="text-xs text-muted-foreground">{t("emptyShipmentHint")}</p>
            </div>
            <Button
              className="self-end"
              disabled={selectableBooks.length === 0}
              onClick={() => setBookSelectionOpen(true)}
              size="sm"
              variant="outline"
            >
              <UiIcon name="plus" size={14} />
              {t("addBooksToShipment")}
            </Button>
          </div>
        )
      ) : null}
    </section>
  );
}
function TextField({
  className,
  label,
  onChange,
  optional,
  type = "text",
  value,
}: {
  className?: string;
  label: string;
  onChange: (value: string) => void;
  optional?: boolean;
  type?: string;
  value: string;
}) {
  return (
    <Field className={className} label={label} optional={optional}>
      <Input
        className="h-10"
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </Field>
  );
}
