import { z } from "zod";

import { CurrencySchema, DeliveryUiStatusSchema, ShipmentStatusSchema } from "./book-enums.js";
import { BookPreviewSchema } from "./book-preview.js";
import { BulkBookIdsSchema } from "./books.js";
import {
  createPaginatedSchema,
  CurrencyAverageSchema,
  CurrencyTotalSchema,
  paginationQueryFields,
} from "./common.js";
import { DeliveryServiceSchema } from "./delivery-services.js";
import { DeliveryViewSchema } from "./delivery-view.js";
import {
  isoDay,
  notInFutureDate,
  QueryBooleanSchema,
  QueryBooleanWithDefaultSchema,
} from "./internal.js";

const DELIVERY_SEARCH_MAX = 100;
const DELIVERY_STORE_MAX = 200;

export const DeliveryInTransitFilterSchema = z.enum([
  "all",
  "ordered",
  "in_transit",
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

export type DeliveryInTransitFilter = z.infer<typeof DeliveryInTransitFilterSchema>;

export const DeliveryInTransitSortSchema = z.enum([
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

export type DeliveryInTransitSort = z.infer<typeof DeliveryInTransitSortSchema>;

export const DeliveryInTransitQuerySchema = z.object({
  filter: DeliveryInTransitFilterSchema.default("all"),
  ...paginationQueryFields({ pageSizeDefault: 10 }),
  search: z.string().trim().max(DELIVERY_SEARCH_MAX).optional(),
  service: DeliveryServiceSchema.optional(),
  sort: DeliveryInTransitSortSchema.default("closest_delivery"),
  store: z.string().trim().max(DELIVERY_STORE_MAX).optional(),
});

export type DeliveryInTransitQuery = z.infer<typeof DeliveryInTransitQuerySchema>;

export const DeliveryListItemViewSchema = z.object({
  book: BookPreviewSchema,
  delivery: DeliveryViewSchema,
  id: z.string(),
  uiStatus: DeliveryUiStatusSchema.nullable(),
});

export type DeliveryListItemView = z.infer<typeof DeliveryListItemViewSchema>;

export const PaginatedDeliveriesSchema = createPaginatedSchema(DeliveryListItemViewSchema);

export const DeliveryInTransitSummaryViewSchema = z.object({
  activeCount: z.number().int().nonnegative(),
  delayedCount: z.number().int().nonnegative(),
  expectedThisWeek: z.number().int().nonnegative(),
  totalByCurrency: z.array(CurrencyTotalSchema),
  uniqueStores: z.number().int().nonnegative(),
});

export type DeliveryInTransitSummaryView = z.infer<typeof DeliveryInTransitSummaryViewSchema>;

export const DeliveryHistoryTabSchema = z.enum(["all", "active", "received", "cancelled"]);

export type DeliveryHistoryTab = z.infer<typeof DeliveryHistoryTabSchema>;

export const DeliveryHistorySortSchema = z.enum([
  "newest_orders",
  "oldest_orders",
  "recently_updated",
  "status",
  "store",
  "price",
  "title",
]);

export type DeliveryHistorySort = z.infer<typeof DeliveryHistorySortSchema>;

export const DeliveryHistoryQuerySchema = z.object({
  currency: CurrencySchema.optional(),
  from: isoDay().optional(),
  hasTrackingNumber: QueryBooleanSchema.optional(),
  hasTrackingUrl: QueryBooleanSchema.optional(),
  ...paginationQueryFields({ pageSizeDefault: 10 }),
  priceMax: z.coerce.number().nonnegative().optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  search: z.string().trim().max(DELIVERY_SEARCH_MAX).optional(),
  service: DeliveryServiceSchema.optional(),
  sort: DeliveryHistorySortSchema.default("newest_orders"),
  store: z.string().trim().max(DELIVERY_STORE_MAX).optional(),
  tab: DeliveryHistoryTabSchema.default("all"),
  to: isoDay().optional(),
});

export type DeliveryHistoryQuery = z.infer<typeof DeliveryHistoryQuerySchema>;

export const DeliveryHistorySummaryQuerySchema = z.object({
  includeCancelled: QueryBooleanWithDefaultSchema,
});

export type DeliveryHistorySummaryQuery = z.infer<typeof DeliveryHistorySummaryQuerySchema>;

export const DeliveryHistorySummaryViewSchema = z.object({
  activeCount: z.number().int().nonnegative(),
  cancelledCount: z.number().int().nonnegative(),
  receivedCount: z.number().int().nonnegative(),
  totalByCurrency: z.array(CurrencyTotalSchema),
  totalOrders: z.number().int().nonnegative(),
});

export type DeliveryHistorySummaryView = z.infer<typeof DeliveryHistorySummaryViewSchema>;

export const DeliveryStatisticsQuerySchema = z.object({
  currency: CurrencySchema.optional(),
  from: isoDay().optional(),
  includeCancelled: QueryBooleanWithDefaultSchema,
  status: ShipmentStatusSchema.optional(),
  store: z.string().trim().max(DELIVERY_STORE_MAX).optional(),
  to: isoDay().optional(),
});

export type DeliveryStatisticsQuery = z.infer<typeof DeliveryStatisticsQuerySchema>;

export const DeliveryStatisticsMonthSchema = z.object({
  month: z.string(),
  ordersCount: z.number().int().nonnegative(),
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type DeliveryStatisticsMonth = z.infer<typeof DeliveryStatisticsMonthSchema>;

export const DeliveryStatisticsStoreSchema = z.object({
  ordersCount: z.number().int().nonnegative(),
  store: z.string(),
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type DeliveryStatisticsStore = z.infer<typeof DeliveryStatisticsStoreSchema>;

export const DeliveryStatisticsStatusGroupSchema = z.object({
  count: z.number().int().nonnegative(),
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type DeliveryStatisticsStatusGroup = z.infer<typeof DeliveryStatisticsStatusGroupSchema>;

export const DeliveryTopOrderSchema = z.object({
  bookId: z.string(),
  bookTitle: z.string(),
  currency: CurrencySchema.nullable(),
  orderDate: z.string().nullable(),
  price: z.number(),
  status: ShipmentStatusSchema,
  storeName: z.string().nullable(),
});

export type DeliveryTopOrder = z.infer<typeof DeliveryTopOrderSchema>;

export const DeliveryStatisticsSummarySchema = z.object({
  activeByCurrency: z.array(CurrencyTotalSchema),
  averageByCurrency: z.array(CurrencyAverageSchema),
  cancelledByCurrency: z.array(CurrencyTotalSchema),
  pricedOrdersCount: z.number().int().nonnegative(),
  receivedByCurrency: z.array(CurrencyTotalSchema),
  totalByCurrency: z.array(CurrencyTotalSchema),
});

export type DeliveryStatisticsSummary = z.infer<typeof DeliveryStatisticsSummarySchema>;

export const DeliveryStatisticsViewSchema = z.object({
  byStore: z.array(DeliveryStatisticsStoreSchema),
  monthly: z.array(DeliveryStatisticsMonthSchema),
  statusBreakdown: z.object({
    active: DeliveryStatisticsStatusGroupSchema,
    cancelled: DeliveryStatisticsStatusGroupSchema,
    received: DeliveryStatisticsStatusGroupSchema,
  }),
  summary: DeliveryStatisticsSummarySchema,
  topOrders: z.array(DeliveryTopOrderSchema),
});

export type DeliveryStatisticsView = z.infer<typeof DeliveryStatisticsViewSchema>;

export const BulkReceiveDeliveriesInputSchema = BulkBookIdsSchema.extend({
  receivedAt: notInFutureDate("Received date must not be in the future").optional(),
});

export type BulkReceiveDeliveriesInput = z.infer<typeof BulkReceiveDeliveriesInputSchema>;

export const BulkReceiveSkipReasonSchema = z.enum(["not_active", "not_found"]);

export type BulkReceiveSkipReason = z.infer<typeof BulkReceiveSkipReasonSchema>;

export const BulkReceiveDeliveriesResultViewSchema = z.object({
  receivedBookIds: z.array(z.string()),
  skipped: z.array(z.object({ bookId: z.string(), reason: BulkReceiveSkipReasonSchema })),
});

export type BulkReceiveDeliveriesResultView = z.infer<typeof BulkReceiveDeliveriesResultViewSchema>;
