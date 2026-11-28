import type {
  ActiveShipmentStatus,
  BookView,
  CreateBookOrderInput,
  Currency,
  Nullable,
} from "@app/shared";

import { DEFAULT_CURRENCY, resolveOrderFinancials } from "@app/shared";

import { assertNever } from "@/lib/assert-never";

export type CreateBookOrderDraft = {
  books: OrderBookDraft[];
  financialMode: FinancialMode;
  order: OrderDraft;
  pickerSelection: BookView[];
  shipments: ShipmentDraft[];
  shipmentToRemoveId: Nullable<string>;
  shipping: "no" | "yes";
  submitAttempted: boolean;
};

export type CreateBookOrderDraftAction =
  | BookPickerOpened
  | BookPriceChanged
  | BookRemoved
  | FinancialModeChanged
  | FreeChanged
  | OrderFieldChanged
  | PickerSelectionApplied
  | PickerSelectionChanged
  | ShipmentAdded
  | ShipmentBookToggled
  | ShipmentChanged
  | ShipmentRemovalCancelled
  | ShipmentRemovalRequested
  | ShipmentRemoved
  | ShipmentsMerged
  | ShippingDisabled
  | ShippingEnabled
  | ShippingSplit
  | SubmitAttempted;

export type FinancialMode = "items" | "total";

export type OrderBookDraft = { book: BookView; price: string };

export type OrderDraft = {
  currency: "" | Currency;
  deliveryPrice: string;
  discount: string;
  isFree: boolean;
  note: string;
  orderDate: string;
  orderNumber: string;
  storeName: string;
  totalAmount: string;
};

export type ShipmentDraft = {
  bookIds: string[];
  deliveryService: string;
  expectedDeliveryDate: string;
  id: string;
  note: string;
  pickupUntil: string;
  status: ActiveShipmentStatus;
  trackingNumber: string;
  trackingUrl: string;
};

type BookPickerOpened = { type: "bookPickerOpened" };

type BookPriceChanged = { bookId: string; price: string; type: "bookPriceChanged" };

type BookRemoved = { bookId: string; type: "bookRemoved" };

type EditableOrderField = Exclude<keyof OrderDraft, "isFree">;

type FinancialModeChanged = { mode: FinancialMode; type: "financialModeChanged" };

type FreeChanged = { isFree: boolean; type: "freeChanged" };

type OrderFieldChanged = {
  [Key in EditableOrderField]: { field: Key; type: "orderFieldChanged"; value: OrderDraft[Key] };
}[EditableOrderField];

type PickerSelectionApplied = { type: "pickerSelectionApplied" };

type PickerSelectionChanged = { books: BookView[]; type: "pickerSelectionChanged" };

type ShipmentAdded = { shipmentId: string; type: "shipmentAdded" };

type ShipmentBookToggled = { bookId: string; shipmentId: string; type: "shipmentBookToggled" };

type ShipmentChanged = {
  patch: Partial<ShipmentDraft>;
  shipmentId: string;
  type: "shipmentChanged";
};

type ShipmentRemovalCancelled = { type: "shipmentRemovalCancelled" };

type ShipmentRemovalRequested = { shipmentId: string; type: "shipmentRemovalRequested" };

type ShipmentRemoved = { shipmentId: string; type: "shipmentRemoved" };

type ShipmentsMerged = { type: "shipmentsMerged" };

type ShippingDisabled = { type: "shippingDisabled" };

type ShippingEnabled = { shipmentId: string; type: "shippingEnabled" };

type ShippingSplit = { addedShipmentId: string; fallbackShipmentId: string; type: "shippingSplit" };

type SubmitAttempted = { type: "submitAttempted" };

export const EMPTY_ORDER: OrderDraft = {
  currency: "UAH",
  deliveryPrice: "",
  discount: "",
  isFree: false,
  note: "",
  orderDate: "",
  orderNumber: "",
  storeName: "",
  totalAmount: "",
};

const ORDER_DRAFT_FIELDS = Object.keys(EMPTY_ORDER).filter(isOrderDraftField);

export const EMPTY_CREATE_BOOK_ORDER_DRAFT: CreateBookOrderDraft = {
  books: [],
  financialMode: "total",
  order: EMPTY_ORDER,
  pickerSelection: [],
  shipments: [],
  shipmentToRemoveId: null,
  shipping: "no",
  submitAttempted: false,
};

export function createBookOrderDraftReducer(
  draft: CreateBookOrderDraft,
  action: CreateBookOrderDraftAction,
): CreateBookOrderDraft {
  switch (action.type) {
    case "bookPickerOpened":
      return { ...draft, pickerSelection: draft.books.map(({ book }) => book) };
    case "bookPriceChanged":
      return replaceBooks(
        draft,
        draft.books.map((item) =>
          item.book.id === action.bookId ? { ...item, price: action.price } : item,
        ),
      );
    case "bookRemoved":
      return removeBook(draft, action.bookId);
    case "financialModeChanged":
      return changeFinancialMode(draft, action.mode);
    case "freeChanged":
      return changeFree(draft, action.isFree);
    case "orderFieldChanged":
      return { ...draft, order: withOrderField(draft.order, action.field, action.value) };
    case "pickerSelectionApplied":
      return applyPickerSelection(draft);
    case "pickerSelectionChanged":
      return { ...draft, pickerSelection: action.books };
    case "shipmentAdded":
      return { ...draft, shipments: [...draft.shipments, inTransitShipment(action.shipmentId)] };
    case "shipmentBookToggled":
      return { ...draft, shipments: toggleShipmentBook(draft.shipments, action) };
    case "shipmentChanged":
      return {
        ...draft,
        shipments: draft.shipments.map((shipment) =>
          shipment.id === action.shipmentId ? { ...shipment, ...action.patch } : shipment,
        ),
      };
    case "shipmentRemovalCancelled":
      return { ...draft, shipmentToRemoveId: null };
    case "shipmentRemovalRequested":
      return requestShipmentRemoval(draft, action.shipmentId);
    case "shipmentRemoved":
      return removeShipment(draft, action.shipmentId);
    case "shipmentsMerged":
      return {
        ...draft,
        shipments: withPrimaryShipmentBooks(
          draft.shipments,
          draft.books.map(({ book }) => book.id),
        ),
      };
    case "shippingDisabled":
      return { ...draft, shipments: [], shipping: "no" };
    case "shippingEnabled":
      return enableShipping(draft, action.shipmentId);
    case "shippingSplit":
      return splitShipping(draft, action);
    case "submitAttempted":
      return { ...draft, submitAttempted: true };
    default:
      return assertNever(action);
  }
}

export function createEmptyShipment(id = crypto.randomUUID()): ShipmentDraft {
  return {
    bookIds: [],
    deliveryService: "",
    expectedDeliveryDate: "",
    id,
    note: "",
    pickupUntil: "",
    status: "ordered",
    trackingNumber: "",
    trackingUrl: "",
  };
}

export function hasCompleteItemPrices(books: OrderBookDraft[]): boolean {
  return books.length > 0 && books.every(({ price }) => price.trim() !== "");
}

export function hasCreateBookOrderInput(draft: CreateBookOrderDraft): boolean {
  const orderChanged = ORDER_DRAFT_FIELDS.some(
    (field) => draft.order[field] !== EMPTY_ORDER[field],
  );

  return (
    orderChanged ||
    draft.books.length > 0 ||
    draft.pickerSelection.length > 0 ||
    draft.shipping !== EMPTY_CREATE_BOOK_ORDER_DRAFT.shipping ||
    draft.financialMode !== EMPTY_CREATE_BOOK_ORDER_DRAFT.financialMode
  );
}

export function optionalNumber(value: string): null | number {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

export function shipmentLayout(
  draft: Pick<CreateBookOrderDraft, "books" | "shipments" | "shipping">,
): "distribution" | "hidden" | "simple" {
  if (draft.shipping === "no" || draft.shipments.length === 0) return "hidden";
  if (draft.shipments.length === 1 && unassignedBooks(draft).length === 0) return "simple";
  return "distribution";
}

export function toCreateBookOrderInput({
  books,
  order,
  shipments,
}: {
  books: { bookId: string; price: string }[];
  order: OrderDraft;
  shipments: ShipmentDraft[];
}): CreateBookOrderInput {
  const financials = resolveOrderFinancials({
    deliveryPrice: optionalNumber(order.deliveryPrice),
    discount: optionalNumber(order.discount),
    isFree: order.isFree,
    itemPrices: books.map(({ price }) => optionalNumber(price)),
    totalAmount: optionalNumber(order.totalAmount),
  });
  return {
    currency: order.currency === "" ? DEFAULT_CURRENCY : order.currency,
    isFree: order.isFree,
    items: books.map(({ bookId, price }) => ({
      bookId,
      ...(order.isFree ? {} : optionalNumberProperty("price", price)),
    })),
    storeName: order.storeName.trim(),
    ...(order.isFree ? {} : optionalNumberProperty("deliveryPrice", order.deliveryPrice)),
    ...(order.isFree ? {} : optionalNumberProperty("discount", order.discount)),
    ...optionalTextProperty("note", order.note),
    ...optionalTextProperty("orderDate", order.orderDate),
    ...optionalTextProperty("orderNumber", order.orderNumber),
    ...(order.isFree || financials.effectiveTotalAmount === null
      ? {}
      : { totalAmount: financials.effectiveTotalAmount }),
    ...(shipments.length === 0
      ? {}
      : {
          shipments: shipments.map((shipment) => ({
            bookIds: shipment.bookIds,
            status: shipment.status,
            ...optionalTextProperty("deliveryService", shipment.deliveryService),
            ...optionalTextProperty("expectedDeliveryDate", shipment.expectedDeliveryDate),
            ...optionalTextProperty("note", shipment.note),
            ...optionalTextProperty("pickupUntil", shipment.pickupUntil),
            ...optionalTextProperty("trackingNumber", shipment.trackingNumber),
            ...optionalTextProperty("trackingUrl", shipment.trackingUrl),
          })),
        }),
  };
}

export function unassignedBooks({
  books,
  shipments,
}: Pick<CreateBookOrderDraft, "books" | "shipments">): OrderBookDraft[] {
  const assignedIds = new Set(shipments.flatMap((shipment) => shipment.bookIds));
  return books.filter(({ book }) => !assignedIds.has(book.id));
}

function applyPickerSelection(draft: CreateBookOrderDraft): CreateBookOrderDraft {
  const selected = draft.pickerSelection;
  const selectedIds = selected.map(({ id }) => id);
  const books = selected.map((book) => ({
    book,
    price: draft.books.find((entry) => entry.book.id === book.id)?.price ?? "",
  }));
  const shipments =
    shipmentLayout(draft) === "simple"
      ? withPrimaryShipmentBooks(draft.shipments, selectedIds)
      : withSelectedBooksOnly(draft.shipments, new Set(selectedIds));
  return { ...replaceBooks(draft, books), shipments };
}

function changeFinancialMode(
  draft: CreateBookOrderDraft,
  mode: FinancialMode,
): CreateBookOrderDraft {
  if (mode === "items") {
    return { ...draft, financialMode: "items", order: { ...draft.order, totalAmount: "" } };
  }
  return { ...draft, books: withoutItemPrices(draft.books), financialMode: "total" };
}

function changeFree(draft: CreateBookOrderDraft, isFree: boolean): CreateBookOrderDraft {
  if (!isFree) return { ...draft, order: { ...draft.order, isFree } };
  return {
    ...draft,
    books: withoutItemPrices(draft.books),
    order: { ...draft.order, deliveryPrice: "", discount: "", isFree, totalAmount: "" },
  };
}

function enableShipping(draft: CreateBookOrderDraft, shipmentId: string): CreateBookOrderDraft {
  const shipments =
    draft.shipments.length > 0
      ? draft.shipments
      : [{ ...inTransitShipment(shipmentId), bookIds: draft.books.map(({ book }) => book.id) }];
  return { ...draft, shipments, shipping: "yes" };
}

function inTransitShipment(id: string): ShipmentDraft {
  return { ...createEmptyShipment(id), status: "in_transit" };
}

function isOrderDraftField(key: string): key is keyof OrderDraft {
  return key in EMPTY_ORDER;
}

function optionalNumberProperty<K extends string>(
  key: K,
  value: string,
): Partial<Record<K, number>> {
  const trimmed = value.trim();
  return trimmed === "" ? {} : ({ [key]: Number(trimmed) } as Record<K, number>);
}

function optionalTextProperty<K extends string>(key: K, value: string): Partial<Record<K, string>> {
  const trimmed = value.trim();
  return trimmed === "" ? {} : ({ [key]: trimmed } as Record<K, string>);
}

function removeBook(draft: CreateBookOrderDraft, bookId: string): CreateBookOrderDraft {
  return {
    ...replaceBooks(
      draft,
      draft.books.filter(({ book }) => book.id !== bookId),
    ),
    shipments: draft.shipments.map((shipment) => ({
      ...shipment,
      bookIds: shipment.bookIds.filter((id) => id !== bookId),
    })),
  };
}

function removeShipment(draft: CreateBookOrderDraft, shipmentId: string): CreateBookOrderDraft {
  return {
    ...draft,
    shipments: draft.shipments.filter(({ id }) => id !== shipmentId),
    shipmentToRemoveId: null,
  };
}

function replaceBooks(draft: CreateBookOrderDraft, books: OrderBookDraft[]): CreateBookOrderDraft {
  const hasLostCompleteBreakdown =
    hasCompleteItemPrices(draft.books) && !hasCompleteItemPrices(books);
  return {
    ...draft,
    books,
    order: hasLostCompleteBreakdown ? { ...draft.order, totalAmount: "" } : draft.order,
  };
}

function requestShipmentRemoval(
  draft: CreateBookOrderDraft,
  shipmentId: string,
): CreateBookOrderDraft {
  const shipment = draft.shipments.find(({ id }) => id === shipmentId);
  if (shipment === undefined || draft.shipments.length <= 1) return draft;
  if (shipment.bookIds.length === 0) return removeShipment(draft, shipmentId);
  return { ...draft, shipmentToRemoveId: shipmentId };
}

function splitShipping(
  draft: CreateBookOrderDraft,
  { addedShipmentId, fallbackShipmentId }: ShippingSplit,
): CreateBookOrderDraft {
  const first = draft.shipments[0] ?? inTransitShipment(fallbackShipmentId);
  return {
    ...draft,
    shipments: [{ ...first, bookIds: [] }, inTransitShipment(addedShipmentId)],
  };
}

function toggleShipmentBook(
  shipments: ShipmentDraft[],
  { bookId, shipmentId }: ShipmentBookToggled,
): ShipmentDraft[] {
  return shipments.map((shipment) => {
    if (shipment.id !== shipmentId) return shipment;
    return {
      ...shipment,
      bookIds: shipment.bookIds.includes(bookId)
        ? shipment.bookIds.filter((id) => id !== bookId)
        : [...shipment.bookIds, bookId],
    };
  });
}

function withOrderField<K extends keyof OrderDraft>(
  order: OrderDraft,
  field: K,
  value: OrderDraft[K],
): OrderDraft {
  return { ...order, [field]: value };
}

function withoutItemPrices(books: OrderBookDraft[]): OrderBookDraft[] {
  return books.map((item) => ({ ...item, price: "" }));
}

function withPrimaryShipmentBooks(shipments: ShipmentDraft[], bookIds: string[]): ShipmentDraft[] {
  return shipments.map((shipment, index) => (index === 0 ? { ...shipment, bookIds } : shipment));
}

function withSelectedBooksOnly(
  shipments: ShipmentDraft[],
  selectedIds: ReadonlySet<string>,
): ShipmentDraft[] {
  return shipments.map((shipment) => ({
    ...shipment,
    bookIds: shipment.bookIds.filter((id) => selectedIds.has(id)),
  }));
}
