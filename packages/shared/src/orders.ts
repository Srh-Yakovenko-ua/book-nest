import { z } from "zod";

import {
  ActiveShipmentStatusSchema,
  CurrencySchema,
  DeliveryUiStatusSchema,
  ShipmentStatusSchema,
} from "./book-enums.js";
import { BookPreviewSchema } from "./book-preview.js";
import {
  createPaginatedSchema,
  CurrencyAverageSchema,
  CurrencyTotalSchema,
  paginationQueryFields,
} from "./common.js";
import { DeliveryServiceSchema } from "./delivery-services.js";
import {
  CancelReasonSchema,
  EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE,
  isExpectedNotBeforeOrder,
  notInFutureDate,
  OwnershipNoteSchema,
  OwnershipOrderNumberSchema,
  OwnershipPriceSchema,
  OwnershipStoreNameSchema,
  OwnershipStoreUrlSchema,
  QueryBooleanWithDefaultSchema,
  TrackingNumberSchema,
} from "./internal.js";

const BOOK_ORDER_LIMITS = {
  itemsMax: 100,
  pageSizeDefault: 10,
  searchMax: 100,
  shipmentsMax: 20,
  storeMax: 200,
} as const;

const BOOK_ORDER_MESSAGES = {
  duplicateMovedItem: "The same order item cannot be moved twice in one request",
  duplicateOrderItem: "The same book cannot be ordered twice in one order",
  duplicateShipmentBook: "The same book cannot be listed twice in one shipment",
  duplicateShipmentItem: "The same order item cannot be listed twice in one shipment",
  shipmentBookNotOrdered: "A shipment can only carry books from this order",
  shipmentBookReused: "A book cannot be placed in two shipments",
  storeNameRequired: "Store name is required",
} as const;

const CountSchema = z.number().int().nonnegative();

const hasUniqueValues = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

export const BookOrderDerivedStatusSchema = z.enum([
  "active",
  "partially_shipped",
  "shipped",
  "partially_received",
  "received",
  "cancelled",
]);

export type BookOrderDerivedStatus = z.infer<typeof BookOrderDerivedStatusSchema>;

export const ShipmentDeliveryServiceViewSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
});

export type ShipmentDeliveryServiceView = z.infer<typeof ShipmentDeliveryServiceViewSchema>;

export const ShipmentViewSchema = z.object({
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  createdAt: z.string(),
  deliveryService: ShipmentDeliveryServiceViewSchema.nullable(),
  expectedDeliveryDate: z.string().nullable(),
  id: z.string(),
  note: z.string().nullable(),
  orderId: z.string(),
  pickupUntil: z.string().nullable(),
  receivedAt: z.string().nullable(),
  status: ShipmentStatusSchema,
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  updatedAt: z.string(),
});

export type ShipmentView = z.infer<typeof ShipmentViewSchema>;

export const BookOrderItemViewSchema = z.object({
  bookId: z.string(),
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
  id: z.string(),
  orderId: z.string(),
  price: z.number().nullable(),
  receivedAt: z.string().nullable(),
  shipmentId: z.string().nullable(),
});

export type BookOrderItemView = z.infer<typeof BookOrderItemViewSchema>;

export const BookOrderViewSchema = z.object({
  createdAt: z.string(),
  currency: CurrencySchema.nullable(),
  deliveryPrice: z.number().nullable(),
  derivedStatus: BookOrderDerivedStatusSchema,
  discount: z.number().nullable(),
  id: z.string(),
  items: z.array(BookOrderItemViewSchema),
  note: z.string().nullable(),
  orderDate: z.string().nullable(),
  orderNumber: z.string().nullable(),
  shipments: z.array(ShipmentViewSchema),
  storeName: z.string(),
  totalAmount: z.number().nullable(),
  updatedAt: z.string(),
});

export type BookOrderView = z.infer<typeof BookOrderViewSchema>;

export const BookOrderItemInputSchema = z.object({
  bookId: z.uuid(),
  price: OwnershipPriceSchema.optional(),
});

export type BookOrderItemInput = z.infer<typeof BookOrderItemInputSchema>;

export const BookOrderShipmentInputSchema = z
  .object({
    bookIds: z.array(z.uuid()).min(1).max(BOOK_ORDER_LIMITS.itemsMax),
    deliveryService: DeliveryServiceSchema.optional(),
    expectedDeliveryDate: z.iso.date().optional(),
    note: OwnershipNoteSchema.optional(),
    pickupUntil: z.iso.date().optional(),
    status: ActiveShipmentStatusSchema.optional(),
    trackingNumber: TrackingNumberSchema.optional(),
    trackingUrl: OwnershipStoreUrlSchema.optional(),
  })
  .refine((shipment) => hasUniqueValues(shipment.bookIds), {
    error: BOOK_ORDER_MESSAGES.duplicateShipmentBook,
    path: ["bookIds"],
  });

export type BookOrderShipmentInput = z.infer<typeof BookOrderShipmentInputSchema>;

const BookOrderStoreNameSchema = OwnershipStoreNameSchema.pipe(
  z.string().min(1, BOOK_ORDER_MESSAGES.storeNameRequired),
);

const BookOrderDraftSchema = z.object({
  currency: CurrencySchema.optional(),
  deliveryPrice: OwnershipPriceSchema.optional(),
  discount: OwnershipPriceSchema.optional(),
  items: z.array(BookOrderItemInputSchema).min(1).max(BOOK_ORDER_LIMITS.itemsMax),
  note: OwnershipNoteSchema.optional(),
  orderDate: notInFutureDate("Order date must not be in the future").optional(),
  orderNumber: OwnershipOrderNumberSchema.optional(),
  shipments: z.array(BookOrderShipmentInputSchema).max(BOOK_ORDER_LIMITS.shipmentsMax).optional(),
  storeName: BookOrderStoreNameSchema,
  totalAmount: OwnershipPriceSchema.optional(),
});

type BookOrderDraft = z.infer<typeof BookOrderDraftSchema>;

const draftShipmentBookIds = (draft: BookOrderDraft): string[] =>
  (draft.shipments ?? []).flatMap((shipment) => shipment.bookIds);

const hasUniqueOrderedBooks = (draft: BookOrderDraft): boolean =>
  new Set(draft.items.map((item) => item.bookId)).size === draft.items.length;

const shipsOnlyOrderedBooks = (draft: BookOrderDraft): boolean => {
  const orderedBookIds = new Set(draft.items.map((item) => item.bookId));
  return draftShipmentBookIds(draft).every((bookId) => orderedBookIds.has(bookId));
};

const shipsEachBookOnce = (draft: BookOrderDraft): boolean =>
  hasUniqueValues(draftShipmentBookIds(draft));

const expectsDeliveryNotBeforeOrderDate = (draft: BookOrderDraft): boolean =>
  (draft.shipments ?? []).every((shipment) =>
    isExpectedNotBeforeOrder({
      expectedDeliveryDate: shipment.expectedDeliveryDate,
      orderDate: draft.orderDate,
    }),
  );

export const CreateBookOrderInputSchema = BookOrderDraftSchema.refine(hasUniqueOrderedBooks, {
  error: BOOK_ORDER_MESSAGES.duplicateOrderItem,
  path: ["items"],
})
  .refine(shipsOnlyOrderedBooks, {
    error: BOOK_ORDER_MESSAGES.shipmentBookNotOrdered,
    path: ["shipments"],
  })
  .refine(shipsEachBookOnce, {
    error: BOOK_ORDER_MESSAGES.shipmentBookReused,
    path: ["shipments"],
  })
  .refine(expectsDeliveryNotBeforeOrderDate, {
    error: EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE,
    path: ["shipments"],
  });

export type CreateBookOrderInput = z.infer<typeof CreateBookOrderInputSchema>;

export const UpdateBookOrderInputSchema = z.object({
  currency: CurrencySchema.nullable().optional(),
  deliveryPrice: OwnershipPriceSchema.nullable().optional(),
  discount: OwnershipPriceSchema.nullable().optional(),
  note: OwnershipNoteSchema.nullable().optional(),
  orderDate: notInFutureDate("Order date must not be in the future").nullable().optional(),
  orderNumber: OwnershipOrderNumberSchema.nullable().optional(),
  storeName: BookOrderStoreNameSchema.optional(),
  totalAmount: OwnershipPriceSchema.nullable().optional(),
});

export type UpdateBookOrderInput = z.infer<typeof UpdateBookOrderInputSchema>;

export const CreateShipmentInputSchema = z
  .object({
    deliveryService: DeliveryServiceSchema.optional(),
    expectedDeliveryDate: z.iso.date().optional(),
    itemIds: z.array(z.uuid()).min(1).max(BOOK_ORDER_LIMITS.itemsMax),
    note: OwnershipNoteSchema.optional(),
    pickupUntil: z.iso.date().optional(),
    status: ActiveShipmentStatusSchema.optional(),
    trackingNumber: TrackingNumberSchema.optional(),
    trackingUrl: OwnershipStoreUrlSchema.optional(),
  })
  .refine((shipment) => hasUniqueValues(shipment.itemIds), {
    error: BOOK_ORDER_MESSAGES.duplicateShipmentItem,
    path: ["itemIds"],
  });

export type CreateShipmentInput = z.infer<typeof CreateShipmentInputSchema>;

export const UpdateShipmentInputSchema = z.object({
  deliveryService: DeliveryServiceSchema.nullable().optional(),
  expectedDeliveryDate: z.iso.date().nullable().optional(),
  note: OwnershipNoteSchema.nullable().optional(),
  pickupUntil: z.iso.date().nullable().optional(),
  status: ActiveShipmentStatusSchema.optional(),
  trackingNumber: TrackingNumberSchema.nullable().optional(),
  trackingUrl: OwnershipStoreUrlSchema.nullable().optional(),
});

export type UpdateShipmentInput = z.infer<typeof UpdateShipmentInputSchema>;

export const MarkShipmentInTransitInputSchema = z.object({
  expectedDeliveryDate: z.iso.date().nullable().optional(),
  trackingNumber: TrackingNumberSchema.nullable().optional(),
});

export type MarkShipmentInTransitInput = z.infer<typeof MarkShipmentInTransitInputSchema>;

export const MarkShipmentReadyForPickupInputSchema = z.object({
  pickupUntil: z.iso.date().nullable().optional(),
});

export type MarkShipmentReadyForPickupInput = z.infer<typeof MarkShipmentReadyForPickupInputSchema>;

export const ReceiveShipmentInputSchema = z.object({
  receivedAt: notInFutureDate("Received date must not be in the future").optional(),
});

export type ReceiveShipmentInput = z.infer<typeof ReceiveShipmentInputSchema>;

export const CancelShipmentInputSchema = z.object({
  cancelReason: CancelReasonSchema.nullable().optional(),
  keepAsWantToBuy: z.boolean().default(true),
});

export type CancelShipmentInput = z.infer<typeof CancelShipmentInputSchema>;

export const CancelBookOrderItemInputSchema = z.object({
  cancelReason: CancelReasonSchema.nullable().optional(),
  keepAsWantToBuy: z.boolean().default(true),
});

export type CancelBookOrderItemInput = z.infer<typeof CancelBookOrderItemInputSchema>;

export const MoveBookOrderItemsInputSchema = z
  .object({
    itemIds: z.array(z.uuid()).min(1).max(BOOK_ORDER_LIMITS.itemsMax),
    shipmentId: z.uuid().nullable(),
  })
  .refine((move) => hasUniqueValues(move.itemIds), {
    error: BOOK_ORDER_MESSAGES.duplicateMovedItem,
    path: ["itemIds"],
  });

export type MoveBookOrderItemsInput = z.infer<typeof MoveBookOrderItemsInputSchema>;

export const InTransitFilterSchema = z.enum([
  "all",
  "ordered",
  "in_transit",
  "ready_for_pickup",
  "arriving_soon",
  "this_week",
  "delayed",
  "no_delivery_date",
  "has_tracking_number",
  "without_tracking_number",
  "has_tracking_url",
  "without_tracking_url",
  "has_price",
  "without_price",
]);

export type InTransitFilter = z.infer<typeof InTransitFilterSchema>;

export const InTransitSortSchema = z.enum([
  "closest_delivery",
  "newest_orders",
  "oldest_orders",
  "delayed_first",
  "store",
  "service",
  "title",
  "author",
  "price",
]);

export type InTransitSort = z.infer<typeof InTransitSortSchema>;

export const IN_TRANSIT_DATE_GROUPS = ["overdue", "today", "upcoming", "no_expected_date"] as const;

export type InTransitDateGroup = (typeof IN_TRANSIT_DATE_GROUPS)[number];

type ExpectedDateOrder = {
  groups: readonly InTransitDateGroup[];
  overdue: "newest_first" | "oldest_first";
};

type ExpectedDateSort = Extract<InTransitSort, "closest_delivery" | "delayed_first">;

export const IN_TRANSIT_EXPECTED_DATE_ORDER = {
  closest_delivery: {
    groups: ["today", "upcoming", "overdue", "no_expected_date"],
    overdue: "newest_first",
  },
  delayed_first: {
    groups: ["overdue", "today", "upcoming", "no_expected_date"],
    overdue: "oldest_first",
  },
} as const satisfies Record<ExpectedDateSort, ExpectedDateOrder>;

export const InTransitQuerySchema = z.object({
  currency: CurrencySchema.optional(),
  filter: InTransitFilterSchema.default("all"),
  ...paginationQueryFields({ pageSizeDefault: BOOK_ORDER_LIMITS.pageSizeDefault }),
  search: z.string().trim().max(BOOK_ORDER_LIMITS.searchMax).optional(),
  service: DeliveryServiceSchema.optional(),
  sort: InTransitSortSchema.default("closest_delivery"),
  store: z.string().trim().max(BOOK_ORDER_LIMITS.storeMax).optional(),
});

export type InTransitQuery = z.infer<typeof InTransitQuerySchema>;

export const BookOrderItemRowOrderViewSchema = z.object({
  currency: CurrencySchema.nullable(),
  id: z.string(),
  orderDate: z.string().nullable(),
  orderNumber: z.string().nullable(),
  storeName: z.string(),
});

export type BookOrderItemRowOrderView = z.infer<typeof BookOrderItemRowOrderViewSchema>;

export const BookOrderItemRowShipmentViewSchema = z.object({
  deliveryService: ShipmentDeliveryServiceViewSchema.nullable(),
  expectedDeliveryDate: z.string().nullable(),
  id: z.string(),
  pickupUntil: z.string().nullable(),
  status: ShipmentStatusSchema,
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().nullable(),
});

export type BookOrderItemRowShipmentView = z.infer<typeof BookOrderItemRowShipmentViewSchema>;

export const BookOrderItemRowViewSchema = z.object({
  book: BookPreviewSchema,
  cancelledAt: z.string().nullable(),
  id: z.string(),
  order: BookOrderItemRowOrderViewSchema,
  price: z.number().nullable(),
  receivedAt: z.string().nullable(),
  shipment: BookOrderItemRowShipmentViewSchema.nullable(),
  uiStatus: DeliveryUiStatusSchema.nullable(),
});

export type BookOrderItemRowView = z.infer<typeof BookOrderItemRowViewSchema>;

export const PaginatedBookOrderItemRowsSchema = createPaginatedSchema(BookOrderItemRowViewSchema);

export type PaginatedBookOrderItemRows = z.infer<typeof PaginatedBookOrderItemRowsSchema>;

export const InTransitSummaryViewSchema = z.object({
  activeBooksCount: CountSchema,
  activeBooksTotalByCurrency: z.array(CurrencyTotalSchema),
  activeOrdersCount: CountSchema,
  activeOrdersTotalByCurrency: z.array(CurrencyTotalSchema),
  activeShipmentsCount: CountSchema,
  attentionCount: CountSchema,
  delayedCount: CountSchema,
  expectedThisWeekCount: CountSchema,
  inTransitCount: CountSchema,
  nextExpectedDelivery: z.string().nullable(),
  orderedCount: CountSchema,
  readyForPickupCount: CountSchema,
  uniqueStoresCount: CountSchema,
  withoutExpectedDateCount: CountSchema,
  withoutPriceCount: CountSchema,
  withoutTrackingCount: CountSchema,
});

export type InTransitSummaryView = z.infer<typeof InTransitSummaryViewSchema>;

export const BookOrderStatisticsQuerySchema = z.object({
  currency: CurrencySchema.optional(),
  from: z.iso.date().optional(),
  includeCancelled: QueryBooleanWithDefaultSchema,
  status: ShipmentStatusSchema.optional(),
  store: z.string().trim().max(BOOK_ORDER_LIMITS.storeMax).optional(),
  to: z.iso.date().optional(),
});

export type BookOrderStatisticsQuery = z.infer<typeof BookOrderStatisticsQuerySchema>;

export const BookOrderStatisticsSummarySchema = z.object({
  activeBooksCount: CountSchema,
  activeShipmentsCount: CountSchema,
  activeTotalsByCurrency: z.array(CurrencyTotalSchema),
  averageBookPriceByCurrency: z.array(CurrencyAverageSchema),
  averageOrderAmountByCurrency: z.array(CurrencyAverageSchema),
  booksCount: CountSchema,
  cancelledOrdersCount: CountSchema,
  cancelledTotalsByCurrency: z.array(CurrencyTotalSchema),
  ordersCount: CountSchema,
  receivedBooksCount: CountSchema,
  receivedTotalsByCurrency: z.array(CurrencyTotalSchema),
  shipmentsCount: CountSchema,
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type BookOrderStatisticsSummary = z.infer<typeof BookOrderStatisticsSummarySchema>;

export const BookOrderStatisticsStoreSchema = z.object({
  averageBookPriceByCurrency: z.array(CurrencyAverageSchema),
  averageOrderAmountByCurrency: z.array(CurrencyAverageSchema),
  booksCount: CountSchema,
  ordersCount: CountSchema,
  store: z.string(),
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type BookOrderStatisticsStore = z.infer<typeof BookOrderStatisticsStoreSchema>;

export const BookOrderStatisticsMonthSchema = z.object({
  booksCount: CountSchema,
  month: z.string(),
  ordersCount: CountSchema,
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type BookOrderStatisticsMonth = z.infer<typeof BookOrderStatisticsMonthSchema>;

export const BookOrderStatisticsTopOrderSchema = z.object({
  booksCount: CountSchema,
  currency: CurrencySchema.nullable(),
  derivedStatus: BookOrderDerivedStatusSchema,
  id: z.string(),
  orderDate: z.string().nullable(),
  orderNumber: z.string().nullable(),
  storeName: z.string(),
  totalAmount: z.number(),
});

export type BookOrderStatisticsTopOrder = z.infer<typeof BookOrderStatisticsTopOrderSchema>;

export const BookOrderStatisticsViewSchema = z.object({
  byStore: z.array(BookOrderStatisticsStoreSchema),
  monthly: z.array(BookOrderStatisticsMonthSchema),
  summary: BookOrderStatisticsSummarySchema,
  topOrders: z.array(BookOrderStatisticsTopOrderSchema),
});

export type BookOrderStatisticsView = z.infer<typeof BookOrderStatisticsViewSchema>;
