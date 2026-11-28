"use client";

import {
  CreateBookOrderInputSchema,
  EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE,
  ORDER_FINANCIAL_MESSAGES,
  validateOrderFinancials,
  validateOrderInvariant,
} from "@app/shared";
import { useTranslations } from "next-intl";
import { useReducer, useState } from "react";
import { toast } from "sonner";

import { DiscardChangesDialog } from "@/components/discard-changes-dialog";
import { UiIcon } from "@/components/icons";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StoreAutocomplete } from "@/features/books/components/store-autocomplete";
import { useDeliveryErrorText } from "@/features/books/hooks/use-delivery-error-text";

import { useCreateBookOrder } from "../api/use-create-book-order";
import {
  createBookOrderDraftReducer,
  EMPTY_CREATE_BOOK_ORDER_DRAFT,
  hasCompleteItemPrices,
  hasCreateBookOrderInput,
  optionalNumber,
  toCreateBookOrderInput,
} from "../model/create-book-order-draft";
import { CreateOrderBookPickerView } from "./create-order-book-picker-view";
import { CreateOrderBooksSection } from "./create-order-books-section";
import { CreateOrderCostSection } from "./create-order-cost-section";
import { Field, FormSection, LabeledDateField, TextField } from "./create-order-form-parts";
import { CreateOrderShippingSection } from "./create-order-shipping-section";

const FINANCIAL_ERROR_KEY = {
  [ORDER_FINANCIAL_MESSAGES.currencyRequired]: "validation.currencyRequired",
  [ORDER_FINANCIAL_MESSAGES.freeOrderCarriesAmounts]: "validation.freeWithAmounts",
  [ORDER_FINANCIAL_MESSAGES.mismatch]: "validation.invalid",
  [ORDER_FINANCIAL_MESSAGES.negativeAmount]: "validation.invalid",
  [ORDER_FINANCIAL_MESSAGES.negativeTotal]: "validation.negativeTotal",
  [ORDER_FINANCIAL_MESSAGES.paidOrderNeedsPositiveTotal]: "validation.positiveTotal",
  [ORDER_FINANCIAL_MESSAGES.unknownTotal]: "validation.totalRequired",
} as const;
const DRAFT_ERROR_KEY = {
  booksRequired: "validation.booksRequired",
  expectedBeforeOrder: "validation.expectedBeforeOrder",
  invalid: "validation.invalid",
  orderDateInFuture: "validation.orderDateInFuture",
  shipmentBooksRequired: "validation.shipmentBooksRequired",
  storeRequired: "validation.storeRequired",
} as const;

type CreateOrderView = "books" | "form";
type DraftIssue = { code: string; message: string; path: readonly PropertyKey[] };

export function CreateBookOrderDialog({
  onCreateBook,
  onOpenChange,
  open,
}: {
  onCreateBook: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const createBookOrder = useCreateBookOrder();
  const [view, setView] = useState<CreateOrderView>("form");

  function changeOpen(nextOpen: boolean) {
    if (!nextOpen) setView("form");
    onOpenChange(nextOpen);
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (createBookOrder.isPending) return;
        changeOpen(nextOpen);
      }}
      open={open}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <div className="grid w-full gap-4">
          {open ? (
            <CreateBookOrderForm
              createBookOrder={createBookOrder}
              onCreateBook={onCreateBook}
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

function CreateBookOrderForm({
  createBookOrder,
  onCreateBook,
  onDone,
  onViewChange,
  view,
}: {
  createBookOrder: ReturnType<typeof useCreateBookOrder>;
  onCreateBook: () => void;
  onDone: () => void;
  onViewChange: (view: CreateOrderView) => void;
  view: CreateOrderView;
}) {
  const t = useTranslations("delivery.createOrder");
  const deliveryErrorText = useDeliveryErrorText();
  const [draft, dispatch] = useReducer(createBookOrderDraftReducer, EMPTY_CREATE_BOOK_ORDER_DRAFT);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const { books, financialMode, order, shipments, shipmentToRemoveId, submitAttempted } = draft;
  const shipmentToRemove = shipments.find(({ id }) => id === shipmentToRemoveId) ?? null;
  const shipmentToRemoveNumber = shipments.findIndex(({ id }) => id === shipmentToRemoveId) + 1;
  const financialInput = {
    currency: order.currency === "" ? null : order.currency,
    deliveryPrice: optionalNumber(order.deliveryPrice),
    discount: optionalNumber(order.discount),
    isFree: order.isFree,
    itemPrices: books.map(({ price }) => optionalNumber(price)),
    totalAmount: optionalNumber(order.totalAmount),
  };
  const shapeCheck = validateOrderFinancials(financialInput);
  const invariantCheck = validateOrderInvariant(financialInput);
  const financialError =
    shapeCheck.error === null ? null : t(FINANCIAL_ERROR_KEY[shapeCheck.error]);
  const invariantError =
    invariantCheck.error === null ? null : t(FINANCIAL_ERROR_KEY[invariantCheck.error]);
  const currency = order.currency === "" ? "UAH" : order.currency;
  const itemPricesIncomplete =
    !order.isFree && financialMode === "items" && !hasCompleteItemPrices(books);
  const parsedDraft = CreateBookOrderInputSchema.safeParse(
    toCreateBookOrderInput({
      books: books.map(({ book, price }) => ({ bookId: book.id, price })),
      order,
      shipments,
    }),
  );
  const submitError = !submitAttempted
    ? null
    : itemPricesIncomplete
      ? t("validation.itemPricesRequired")
      : (invariantError ??
        (parsedDraft.success ? null : t(draftErrorKey(parsedDraft.error.issues[0]))));
  const storeInvalid =
    submitAttempted &&
    !parsedDraft.success &&
    parsedDraft.error.issues.some((issue) => issue.path[0] === "storeName");

  function openBookPicker() {
    dispatch({ type: "bookPickerOpened" });
    onViewChange("books");
  }

  function leaveForNewBook() {
    onDone();
    onCreateBook();
  }

  function requestNewBook() {
    if (hasCreateBookOrderInput(draft)) {
      setLeaveConfirmOpen(true);
      return;
    }
    leaveForNewBook();
  }

  function submit() {
    dispatch({ type: "submitAttempted" });
    if (itemPricesIncomplete || !parsedDraft.success) return;
    createBookOrder.mutate(parsedDraft.data, {
      onError: (error) => toast.error(deliveryErrorText(error)),
      onSuccess: () => {
        toast.success(t("toast.success"));
        onDone();
      },
    });
  }

  if (view === "books") {
    return (
      <>
        <CreateOrderBookPickerView
          onBack={() => onViewChange("form")}
          onCreateBook={requestNewBook}
          onDone={() => {
            dispatch({ type: "pickerSelectionApplied" });
            onViewChange("form");
          }}
          onSelectedChange={(selected) =>
            dispatch({ books: selected, type: "pickerSelectionChanged" })
          }
          selected={draft.pickerSelection}
        />
        <DiscardChangesDialog
          onConfirm={leaveForNewBook}
          onOpenChange={setLeaveConfirmOpen}
          open={leaveConfirmOpen}
        />
      </>
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
                invalid={storeInvalid}
                label={t("order.store")}
                onChange={(value) =>
                  dispatch({ field: "storeName", type: "orderFieldChanged", value })
                }
                placeholder={t("order.storePlaceholder")}
                value={order.storeName}
              />
            </Field>
            <TextField
              className="sm:col-span-3"
              label={t("order.number")}
              onChange={(value) =>
                dispatch({ field: "orderNumber", type: "orderFieldChanged", value })
              }
              optional
              value={order.orderNumber}
            />
            <LabeledDateField
              className="sm:col-span-4"
              id="order-date"
              label={t("order.date")}
              onChange={(value) =>
                dispatch({ field: "orderDate", type: "orderFieldChanged", value })
              }
              optional
              value={order.orderDate}
            />
          </div>
        </FormSection>

        <CreateOrderBooksSection
          books={books}
          currency={currency}
          dispatch={dispatch}
          financialMode={financialMode}
          onOpenPicker={openBookPicker}
        />

        <CreateOrderCostSection
          currency={currency}
          dispatch={dispatch}
          financialError={financialError}
          financialMode={financialMode}
          financials={shapeCheck.summary}
          order={order}
        />

        <CreateOrderShippingSection
          books={books}
          dispatch={dispatch}
          shipments={shipments}
          shipping={draft.shipping}
        />

        <Field htmlFor="order-note" label={t("order.note")} optional>
          <Textarea
            id="order-note"
            onChange={(event) =>
              dispatch({ field: "note", type: "orderFieldChanged", value: event.target.value })
            }
            value={order.note}
          />
        </Field>
      </div>

      {submitError === null ? null : (
        <p className="text-sm text-destructive" role="alert">
          {submitError}
        </p>
      )}
      <DialogFooter>
        <Button disabled={createBookOrder.isPending} onClick={onDone} variant="outline">
          {t("cancel")}
        </Button>
        <Button
          disabled={createBookOrder.isPending}
          loading={createBookOrder.isPending}
          onClick={submit}
        >
          {t("submit")}
        </Button>
      </DialogFooter>
      <AlertDialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen) dispatch({ type: "shipmentRemovalCancelled" });
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
                if (shipmentToRemove === null) return;
                dispatch({ shipmentId: shipmentToRemove.id, type: "shipmentRemoved" });
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

function draftErrorKey(issue: DraftIssue | undefined) {
  if (issue === undefined) return DRAFT_ERROR_KEY.invalid;
  const [field, , shipmentField] = issue.path;
  if (issue.message === EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE) {
    return DRAFT_ERROR_KEY.expectedBeforeOrder;
  }
  if (field === "storeName" && issue.code === "too_small") return DRAFT_ERROR_KEY.storeRequired;
  if (field === "orderDate" && issue.code === "custom") return DRAFT_ERROR_KEY.orderDateInFuture;
  if (field === "items" && issue.code === "too_small") return DRAFT_ERROR_KEY.booksRequired;
  if (field === "shipments" && shipmentField === "bookIds" && issue.code === "too_small") {
    return DRAFT_ERROR_KEY.shipmentBooksRequired;
  }
  return DRAFT_ERROR_KEY.invalid;
}
