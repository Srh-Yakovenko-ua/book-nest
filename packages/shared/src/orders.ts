import { z } from "zod";

import {
  ActiveShipmentStatusSchema,
  CurrencySchema,
  DeliveryUiStatusSchema,
  ShipmentStatusSchema,
} from "./book-enums.js";
import { BookPreviewSchema } from "./book-preview.js";
import { BulkBookIdsSchema } from "./books.js";
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
  isoDay,
  notInFutureDate,
  OwnershipNoteSchema,
  OwnershipOrderNumberSchema,
  OwnershipPriceSchema,
  OwnershipStoreNameSchema,
  OwnershipStoreUrlSchema,
  QueryBooleanSchema,
  QueryBooleanWithDefaultSchema,
  queryStringArray,
  TrackingNumberSchema,
} from "./internal.js";
import { MediaViewSchema } from "./media.js";
import { ORDER_FINANCIAL_MESSAGES, validateOrderFinancials } from "./order-financials.js";

export { EXPECTED_DELIVERY_BEFORE_ORDER_MESSAGE, isExpectedNotBeforeOrder } from "./internal.js";

export const BOOK_ORDER_LIMITS = {
  booksCountMax: 1000,
  itemsMax: 100,
  pageSizeDefault: 10,
  searchMax: 100,
  shipmentsMax: 20,
  storeMax: 200,
} as const;

export const DELIVERY_ERROR_CODES = {
  bookAlreadyOrdered: "DELIVERY_BOOK_ALREADY_ORDERED",
  bookNotOrderable: "DELIVERY_BOOK_NOT_ORDERABLE",
  expectedBeforeOrderDate: "DELIVERY_EXPECTED_BEFORE_ORDER_DATE",
  itemAlreadyCancelled: "DELIVERY_ITEM_ALREADY_CANCELLED",
  itemAlreadyReceived: "DELIVERY_ITEM_ALREADY_RECEIVED",
  itemNoLongerActive: "DELIVERY_ITEM_NO_LONGER_ACTIVE",
  itemsNotMovable: "DELIVERY_ITEMS_NOT_MOVABLE",
  sharedOrder: "DELIVERY_SHARED_ORDER",
  sharedShipment: "DELIVERY_SHARED_SHIPMENT",
  shipmentNotActive: "DELIVERY_SHIPMENT_NOT_ACTIVE",
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

const PositiveCountSchema = z.number().int().positive();

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
    expectedDeliveryDate: isoDay().optional(),
    note: OwnershipNoteSchema.optional(),
    pickupUntil: isoDay().optional(),
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
  })
  .superRefine((draft, context) => {
    const validation = validateOrderFinancials({
      deliveryPrice: draft.deliveryPrice,
      discount: draft.discount,
      itemPrices: draft.items.map((item) => item.price ?? null),
      totalAmount: draft.totalAmount,
    });
    if (validation.error !== null) {
      context.addIssue({
        code: "custom",
        message: validation.error,
        path:
          validation.error === ORDER_FINANCIAL_MESSAGES.negativeTotal
            ? ["discount"]
            : ["totalAmount"],
      });
    }
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
    expectedDeliveryDate: isoDay().optional(),
    itemIds: z.array(z.uuid()).min(1).max(BOOK_ORDER_LIMITS.itemsMax),
    note: OwnershipNoteSchema.optional(),
    pickupUntil: isoDay().optional(),
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
  expectedDeliveryDate: isoDay().nullable().optional(),
  note: OwnershipNoteSchema.nullable().optional(),
  pickupUntil: isoDay().nullable().optional(),
  status: ActiveShipmentStatusSchema.optional(),
  trackingNumber: TrackingNumberSchema.nullable().optional(),
  trackingUrl: OwnershipStoreUrlSchema.nullable().optional(),
});

export type UpdateShipmentInput = z.infer<typeof UpdateShipmentInputSchema>;

export const MarkShipmentInTransitInputSchema = z.object({
  expectedDeliveryDate: isoDay().nullable().optional(),
  trackingNumber: TrackingNumberSchema.nullable().optional(),
});

export type MarkShipmentInTransitInput = z.infer<typeof MarkShipmentInTransitInputSchema>;

export const MarkShipmentReadyForPickupInputSchema = z.object({
  pickupUntil: isoDay().nullable().optional(),
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

export const BulkReceiveOrderItemsInputSchema = BulkBookIdsSchema.extend({
  receivedAt: notInFutureDate("Received date must not be in the future").optional(),
});

export type BulkReceiveOrderItemsInput = z.infer<typeof BulkReceiveOrderItemsInputSchema>;

export const BulkReceiveOrderItemSkipReasonSchema = z.enum(["not_active", "not_found"]);

export type BulkReceiveOrderItemSkipReason = z.infer<typeof BulkReceiveOrderItemSkipReasonSchema>;

export const BulkReceiveOrderItemsResultViewSchema = z.object({
  receivedBookIds: z.array(z.string()),
  skipped: z.array(z.object({ bookId: z.string(), reason: BulkReceiveOrderItemSkipReasonSchema })),
});

export type BulkReceiveOrderItemsResultView = z.infer<typeof BulkReceiveOrderItemsResultViewSchema>;

export const IN_TRANSIT_ATTENTION_THRESHOLDS = {
  awaitingDispatchDays: 7,
  pickupExpiringDays: 2,
} as const;

export const InTransitFilterSchema = z.enum([
  "all",
  "ordered",
  "in_transit",
  "ready_for_pickup",
  "arriving_soon",
  "this_week",
  "delayed",
  "pickup_expiring",
  "awaiting_dispatch",
  "unassigned",
  "no_delivery_date",
  "has_tracking_number",
  "without_tracking_number",
  "has_tracking_url",
  "without_tracking_url",
  "has_price",
  "without_price",
]);

export type InTransitFilter = z.infer<typeof InTransitFilterSchema>;

export const InTransitAttentionReasonSchema = z.enum([
  "pickup_expiring",
  "delayed",
  "awaiting_dispatch",
  "without_tracking",
  "without_expected_date",
  "unassigned_books",
]);

export type InTransitAttentionReason = z.infer<typeof InTransitAttentionReasonSchema>;

export const InTransitAttentionSchema = z.discriminatedUnion("reason", [
  z.object({
    count: CountSchema,
    expiredCount: CountSchema,
    nearestPickupUntil: isoDay()
      .nullable()
      .describe(
        "The soonest pickup deadline that has not passed yet. Null when every expiring parcel is already past its deadline.",
      ),
    reason: z.literal("pickup_expiring"),
  }),
  z.object({
    count: CountSchema,
    maxDelayDays: z.number().int().positive(),
    reason: z.literal("delayed"),
  }),
  z.object({
    count: CountSchema,
    maxWaitingDays: z.number().int().positive(),
    reason: z.literal("awaiting_dispatch"),
  }),
  z.object({
    count: CountSchema,
    reason: z.literal("without_tracking"),
  }),
  z.object({
    count: CountSchema,
    reason: z.literal("without_expected_date"),
  }),
  z.object({
    count: CountSchema,
    ordersCount: CountSchema,
    reason: z.literal("unassigned_books"),
    revealOrderId: z
      .uuid()
      .nullable()
      .describe("The affected order when exactly one order is affected, null otherwise."),
  }),
]);

export type InTransitAttention = z.infer<typeof InTransitAttentionSchema>;

export const IN_TRANSIT_ATTENTION_FILTER = {
  awaiting_dispatch: "awaiting_dispatch",
  delayed: "delayed",
  pickup_expiring: "pickup_expiring",
  unassigned_books: "unassigned",
  without_expected_date: "no_delivery_date",
  without_tracking: "without_tracking_number",
} as const satisfies Record<InTransitAttentionReason, InTransitFilter>;

export const IN_TRANSIT_IMPACT_LIMITS = {
  visible: 3,
} as const;

export const InTransitImpactKindSchema = z.enum([
  "series_completed",
  "series_ownership_gaps",
  "queue_available",
  "series_next_step",
  "goal_books",
]);

export type InTransitImpactKind = z.infer<typeof InTransitImpactKindSchema>;

export const InTransitImpactSchema = z.discriminatedUnion("kind", [
  z.object({
    booksCount: PositiveCountSchema,
    kind: z.literal("series_completed"),
    seriesCount: PositiveCountSchema,
  }),
  z.object({
    booksCount: PositiveCountSchema,
    kind: z.literal("series_ownership_gaps"),
    seriesCount: PositiveCountSchema,
  }),
  z.object({
    booksCount: PositiveCountSchema,
    highPriorityCount: CountSchema,
    kind: z.literal("queue_available"),
  }),
  z.object({
    kind: z.literal("series_next_step"),
    seriesCount: PositiveCountSchema,
  }),
  z.object({
    booksCount: PositiveCountSchema,
    goalsCount: PositiveCountSchema,
    kind: z.literal("goal_books"),
  }),
]);

export type InTransitImpact = z.infer<typeof InTransitImpactSchema>;

export const InTransitImpactViewSchema = z.object({
  items: z
    .array(InTransitImpactSchema)
    .describe(
      "What receiving the books in active deliveries would change, ordered by semantic value. Empty when nothing meaningful would change.",
    ),
});

export type InTransitImpactView = z.infer<typeof InTransitImpactViewSchema>;

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

export const InTransitDeliveryStructureSchema = z.enum([
  "no_shipment",
  "single_shipment",
  "multiple_shipments",
]);

export type InTransitDeliveryStructure = z.infer<typeof InTransitDeliveryStructureSchema>;

export const InTransitPricePresenceSchema = z.enum(["known", "unknown"]);

export type InTransitPricePresence = z.infer<typeof InTransitPricePresenceSchema>;

export const InTransitQuerySchema = z.object({
  booksMax: z.coerce.number().int().min(0).max(BOOK_ORDER_LIMITS.booksCountMax).optional(),
  booksMin: z.coerce.number().int().min(0).max(BOOK_ORDER_LIMITS.booksCountMax).optional(),
  currency: queryStringArray(CurrencySchema),
  expectedFrom: isoDay().optional(),
  expectedTo: isoDay().optional(),
  filter: InTransitFilterSchema.default("all"),
  orderedFrom: isoDay().optional(),
  orderedTo: isoDay().optional(),
  ...paginationQueryFields({ pageSizeDefault: BOOK_ORDER_LIMITS.pageSizeDefault }),
  priceCurrency: CurrencySchema.optional().describe(
    "Gates the canonical order total range. The range is ignored unless exactly one currency is named here.",
  ),
  priceMax: z.coerce.number().nonnegative().optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  pricePresence: InTransitPricePresenceSchema.optional(),
  search: z.string().trim().max(BOOK_ORDER_LIMITS.searchMax).optional(),
  service: queryStringArray(DeliveryServiceSchema),
  sort: InTransitSortSchema.default("closest_delivery"),
  store: queryStringArray(z.string().trim().max(BOOK_ORDER_LIMITS.storeMax)),
  structure: queryStringArray(InTransitDeliveryStructureSchema),
});

export type InTransitQuery = z.infer<typeof InTransitQuerySchema>;

export const InTransitFacetEntrySchema = z.object({ count: CountSchema, name: z.string() });

export type InTransitFacetEntry = z.infer<typeof InTransitFacetEntrySchema>;

export const InTransitFacetsViewSchema = z.object({
  services: z
    .array(InTransitFacetEntrySchema)
    .describe(
      "Delivery services carrying an active shipment of an order that still has books on their way, with how many such orders each one carries.",
    ),
  stores: z
    .array(InTransitFacetEntrySchema)
    .describe("Stores of the orders that still have books on their way, with their order counts."),
});

export type InTransitFacetsView = z.infer<typeof InTransitFacetsViewSchema>;

export const BookOrderHistoryTabSchema = z.enum(["all", "active", "received", "cancelled"]);

export type BookOrderHistoryTab = z.infer<typeof BookOrderHistoryTabSchema>;

export const BookOrderHistorySortSchema = z.enum([
  "newest_orders",
  "oldest_orders",
  "recently_updated",
  "status",
  "store",
  "price",
  "title",
]);

export type BookOrderHistorySort = z.infer<typeof BookOrderHistorySortSchema>;

export const BookOrderHistoryQuerySchema = z.object({
  currency: CurrencySchema.optional(),
  from: isoDay().optional(),
  hasTrackingNumber: QueryBooleanSchema.optional(),
  hasTrackingUrl: QueryBooleanSchema.optional(),
  ...paginationQueryFields({ pageSizeDefault: BOOK_ORDER_LIMITS.pageSizeDefault }),
  priceMax: z.coerce.number().nonnegative().optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  search: z.string().trim().max(BOOK_ORDER_LIMITS.searchMax).optional(),
  service: DeliveryServiceSchema.optional(),
  sort: BookOrderHistorySortSchema.default("newest_orders"),
  store: z.string().trim().max(BOOK_ORDER_LIMITS.storeMax).optional(),
  tab: BookOrderHistoryTabSchema.default("all"),
  to: isoDay().optional(),
});

export type BookOrderHistoryQuery = z.infer<typeof BookOrderHistoryQuerySchema>;

export const BookOrderHistorySummaryQuerySchema = z.object({
  includeCancelled: QueryBooleanWithDefaultSchema,
});

export type BookOrderHistorySummaryQuery = z.infer<typeof BookOrderHistorySummaryQuerySchema>;

export const BookOrderHistorySummaryViewSchema = z.object({
  activeBooksCount: CountSchema,
  booksCount: CountSchema,
  cancelledBooksCount: CountSchema,
  ordersCount: CountSchema,
  receivedBooksCount: CountSchema,
  shipmentsCount: CountSchema.describe(
    "How many distinct shipments carry the counted books. A shipment that carries no counted book is not part of this number.",
  ),
  totalByCurrency: z
    .array(CurrencyTotalSchema)
    .describe(
      "The only field the includeCancelled flag narrows. Every count above spans cancelled books as well, and reports them separately.",
    ),
});

export type BookOrderHistorySummaryView = z.infer<typeof BookOrderHistorySummaryViewSchema>;

export const BookOrderItemRowOrderViewSchema = z.object({
  currency: CurrencySchema.nullable(),
  deliveryPrice: z.number().nullable(),
  derivedStatus: BookOrderDerivedStatusSchema,
  discount: z.number().nullable(),
  effectiveTotalAmount: z
    .number()
    .nullable()
    .describe(
      "What the whole order costs, resolved by resolveOrderFinancials over every one of its books - not only the ones on this page. Null when the breakdown is incomplete and no manual total was entered.",
    ),
  id: z.string(),
  itemsCount: CountSchema.describe("How many books the whole order holds, page and filter aside."),
  orderDate: z.string().nullable(),
  orderNumber: z.string().nullable(),
  pricedItemsCount: CountSchema.describe("How many of those books carry a price."),
  storeName: z.string(),
  totalAmount: z.number().nullable(),
});

export type BookOrderItemRowOrderView = z.infer<typeof BookOrderItemRowOrderViewSchema>;

export const BookOrderItemRowShipmentViewSchema = z.object({
  deliveryService: ShipmentDeliveryServiceViewSchema.nullable(),
  expectedDeliveryDate: z.string().nullable(),
  id: z.string(),
  note: z.string().nullable(),
  pickupUntil: z.string().nullable(),
  status: ShipmentStatusSchema,
  trackingNumber: z.string().nullable(),
  trackingUrl: z.string().nullable(),
});

export type BookOrderItemRowShipmentView = z.infer<typeof BookOrderItemRowShipmentViewSchema>;

export const BookOrderItemRowViewSchema = z.object({
  book: BookPreviewSchema,
  cancelledAt: z.string().nullable(),
  cancelReason: z.string().nullable(),
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

export const NEXT_SHIPMENT_LIMITS = {
  bookPreviewsMax: 3,
} as const;

export const NextShipmentStatusSchema = ShipmentStatusSchema.extract(["ordered", "in_transit"]);

export type NextShipmentStatus = z.infer<typeof NextShipmentStatusSchema>;

export const NextShipmentBookViewSchema = z.object({
  authorName: z.string(),
  cover: MediaViewSchema.nullable(),
  id: z.string(),
  title: z.string(),
});

export type NextShipmentBookView = z.infer<typeof NextShipmentBookViewSchema>;

export const NextShipmentViewSchema = z.object({
  bookPreviews: z
    .array(NextShipmentBookViewSchema)
    .max(NEXT_SHIPMENT_LIMITS.bookPreviewsMax)
    .describe(
      "At most three books, enough to render one book in full or a stack of covers. booksCount carries the real size.",
    ),
  booksCount: CountSchema,
  deliveryService: ShipmentDeliveryServiceViewSchema.nullable(),
  expectedDeliveryDate: isoDay(),
  orderId: z.string(),
  sameDayCount: CountSchema.describe(
    "How many OTHER qualifying shipments share this expected date. Zero when this one stands alone.",
  ),
  shipmentId: z.string(),
  status: NextShipmentStatusSchema,
  storeName: z.string(),
  trackingNumber: z.string().nullable(),
});

export type NextShipmentView = z.infer<typeof NextShipmentViewSchema>;

export const InTransitSummaryViewSchema = z.object({
  activeBooksCount: CountSchema,
  activeBooksTotalByCurrency: z.array(CurrencyTotalSchema),
  activeOrdersCount: CountSchema,
  activeOrdersTotalByCurrency: z.array(CurrencyTotalSchema),
  activeShipmentsCount: CountSchema,
  arrivingSoonCount: CountSchema,
  attention: z
    .array(InTransitAttentionSchema)
    .describe(
      "Cases that ask the reader to act, ordered by severity: pickup_expiring, delayed, awaiting_dispatch, without_tracking, without_expected_date, unassigned_books. A case with a zero count is left out, and each case counts in its own unit - parcels, orders or books.",
    ),
  delayedCount: CountSchema,
  expectedThisWeekCount: CountSchema,
  inTransitCount: CountSchema,
  nextExpectedDelivery: z.string().nullable(),
  nextExpectedThisWeek: z.string().nullable(),
  nextShipment: NextShipmentViewSchema.nullable().describe(
    "The soonest shipment still awaiting arrival: status ordered or in_transit, an expected date of today or later, and at least one active book. Null when nothing qualifies.",
  ),
  orderedCount: CountSchema,
  ordersWithKnownTotalCount: CountSchema,
  readyForPickupCount: CountSchema,
  splitOrdersCount: CountSchema,
  uniqueStoresCount: CountSchema,
  withoutExpectedDateCount: CountSchema,
  withoutPriceCount: CountSchema,
  withoutTrackingCount: CountSchema,
});

export type InTransitSummaryView = z.infer<typeof InTransitSummaryViewSchema>;

export const BookOrderStatisticsQuerySchema = z.object({
  currency: CurrencySchema.optional(),
  from: isoDay().optional(),
  includeCancelled: QueryBooleanWithDefaultSchema,
  status: ShipmentStatusSchema.optional(),
  store: z.string().trim().max(BOOK_ORDER_LIMITS.storeMax).optional(),
  to: isoDay().optional(),
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
