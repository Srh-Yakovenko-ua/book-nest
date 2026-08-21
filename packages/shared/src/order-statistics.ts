import { z } from "zod";

import type { OrderTotalSource } from "./order-financials.js";

import { CurrencySchema } from "./book-enums.js";
import { CurrencyTotalSchema, type Nullable } from "./common.js";
import { CountSchema, isoDay } from "./internal.js";

export const BookOrderStatisticsCompareModeSchema = z.enum([
  "previous_period",
  "same_period_last_year",
]);

export type BookOrderStatisticsCompareMode = z.infer<typeof BookOrderStatisticsCompareModeSchema>;

export const StatisticsPeriodSchema = z.object({
  from: isoDay().nullable(),
  to: isoDay().nullable(),
});

export type StatisticsPeriod = z.infer<typeof StatisticsPeriodSchema>;

export const StatisticsComparisonPeriodSchema = z.object({
  from: isoDay(),
  mode: BookOrderStatisticsCompareModeSchema,
  to: isoDay(),
});

export type StatisticsComparisonPeriod = z.infer<typeof StatisticsComparisonPeriodSchema>;

export const BookOrderStatisticsMetaSchema = z.object({
  comparisonPeriod: StatisticsComparisonPeriodSchema.nullable(),
  currentPeriod: StatisticsPeriodSchema,
  isTruncated: z.boolean(),
  loadedOrdersCount: CountSchema,
  maxOrders: z.number().int().positive().nullable(),
});

export type BookOrderStatisticsMeta = z.infer<typeof BookOrderStatisticsMetaSchema>;

export const NumericDeltaSchema = z.object({
  absoluteDelta: z.number().nullable(),
  current: z.number().nullable(),
  percentDelta: z.number().nullable(),
  previous: z.number().nullable(),
});

export type NumericDelta = z.infer<typeof NumericDeltaSchema>;

export const CurrencyDeltaSchema = NumericDeltaSchema.extend({ currency: CurrencySchema });

export type CurrencyDelta = z.infer<typeof CurrencyDeltaSchema>;

export const OrderTotalSourceSchema = z.enum([
  "free",
  "manual",
  "calculated",
  "unknown",
]) satisfies z.ZodType<OrderTotalSource>;

export const CurrencyCountSchema = z.object({ count: CountSchema, currency: CurrencySchema });

export type CurrencyCount = z.infer<typeof CurrencyCountSchema>;

export const BookOrderStatisticsSnapshotSchema = z
  .object({
    activeBooksCount: CountSchema,
    activeOrdersCount: CountSchema,
    activeShipmentsCount: CountSchema,
    activeTotalsByCurrency: z.array(CurrencyTotalSchema),
  })
  .describe(
    "Money that is still on its way right now. This block deliberately ignores the historical from/to period filter, so it stays a current snapshot and never turns into a period-bound number. No comparison is emitted for it.",
  );

export type BookOrderStatisticsSnapshot = z.infer<typeof BookOrderStatisticsSnapshotSchema>;

export const BookOrderStatisticsComparisonSchema = z.object({
  averageBookPriceByCurrency: z.array(CurrencyDeltaSchema),
  averageBooksPerOrder: NumericDeltaSchema,
  averageOrderAmountByCurrency: z.array(CurrencyDeltaSchema),
  booksCount: NumericDeltaSchema,
  ordersCount: NumericDeltaSchema,
  receivedBooksCount: NumericDeltaSchema,
  shipmentsCount: NumericDeltaSchema,
  totalsByCurrency: z.array(CurrencyDeltaSchema),
});

export type BookOrderStatisticsComparison = z.infer<typeof BookOrderStatisticsComparisonSchema>;

export const BookOrderStatisticsCurrencyCostsSchema = z
  .object({
    currency: CurrencySchema,
    deliveryCostPerBook: z.number().nullable(),
    deliveryShareOfSpendPercent: z.number().nullable(),
    deliveryTotal: z.number(),
    discountShareOfRawSubtotalPercent: z.number().nullable(),
    discountTotal: z.number(),
    ordersWithDeliveryCount: CountSchema,
    ordersWithDiscountCount: CountSchema,
  })
  .describe(
    "Cost composition inside one currency. A null share or per-book value means the denominator was zero or unknown, never that the value is missing from the response.",
  );

export type BookOrderStatisticsCurrencyCosts = z.infer<
  typeof BookOrderStatisticsCurrencyCostsSchema
>;

export const BookOrderStatisticsCostsSchema = z.array(BookOrderStatisticsCurrencyCostsSchema);

export type BookOrderStatisticsCosts = z.infer<typeof BookOrderStatisticsCostsSchema>;

export const BookOrderStatisticsLandedCoverageSchema = z.object({
  countedBooksCount: CountSchema,
  coveragePercent: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "Share of landed-eligible books that actually received an allocated landed cost. It is 0, never null, when countedBooksCount is 0.",
    ),
  currency: CurrencySchema,
  eligibleBooksCount: CountSchema,
});

export type BookOrderStatisticsLandedCoverage = z.infer<
  typeof BookOrderStatisticsLandedCoverageSchema
>;

export const BookOrderStatisticsLandedCostSchema = BookOrderStatisticsLandedCoverageSchema.extend({
  averageLandedBookCost: z.number().nullable(),
  differenceVsAverageRawBookPrice: z.number().nullable(),
});

export type BookOrderStatisticsLandedCost = z.infer<typeof BookOrderStatisticsLandedCostSchema>;

export const BookOrderStatisticsLandedSchema = z.array(BookOrderStatisticsLandedCostSchema);

export type BookOrderStatisticsLanded = z.infer<typeof BookOrderStatisticsLandedSchema>;

export const BOOK_ORDER_BEST_VALUE_STORE_RULES = {
  minimumEligibleBooks: 2,
  tieBreakOrder: [
    "lowest_average_landed_book_cost",
    "most_landed_eligible_books",
    "store_name_ascending",
  ],
} as const;

export const BookOrderStatisticsBestValueStoreSchema = z
  .object({
    averageLandedBookCost: z.number(),
    currency: CurrencySchema,
    eligibleBooksCount: CountSchema.min(BOOK_ORDER_BEST_VALUE_STORE_RULES.minimumEligibleBooks),
    store: z.string(),
  })
  .describe(
    "One winner per currency, never across currencies. A candidate needs at least two landed-eligible books; ties break by the most landed-eligible books, then by store name ascending.",
  );

export type BookOrderStatisticsBestValueStore = z.infer<
  typeof BookOrderStatisticsBestValueStoreSchema
>;

export const BookOrderStatisticsBestValueStoreByCurrencySchema = z.array(
  BookOrderStatisticsBestValueStoreSchema,
);

export type BookOrderStatisticsBestValueStoreByCurrency = z.infer<
  typeof BookOrderStatisticsBestValueStoreByCurrencySchema
>;

export const BookOrderStatisticsRecordScopeSchema = z
  .object({
    isPeriodFiltered: z.boolean(),
    isTruncated: z.boolean(),
    period: StatisticsPeriodSchema,
  })
  .describe(
    "Bounds of a record fact. When isPeriodFiltered or isTruncated is true the record holds only inside this scope and must not be presented as an all-time record.",
  );

export type BookOrderStatisticsRecordScope = z.infer<typeof BookOrderStatisticsRecordScopeSchema>;

export const BookOrderStatisticsPulseToneSchema = z.enum(["neutral", "positive", "attention"]);

export type BookOrderStatisticsPulseTone = z.infer<typeof BookOrderStatisticsPulseToneSchema>;

export const BookOrderStatisticsPulseSignalSchema = z.discriminatedUnion("code", [
  CurrencyDeltaSchema.extend({
    code: z.literal("spend_change"),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  CurrencyDeltaSchema.extend({
    code: z.literal("avg_book_price_change"),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  CurrencyDeltaSchema.extend({
    code: z.literal("avg_landed_cost_change"),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  z.object({
    booksCount: CountSchema,
    code: z.literal("record_month"),
    currency: CurrencySchema,
    month: z.string(),
    ordersCount: CountSchema,
    scope: BookOrderStatisticsRecordScopeSchema,
    tone: BookOrderStatisticsPulseToneSchema,
    total: z.number(),
  }),
  CurrencyDeltaSchema.extend({
    code: z.literal("store_growth"),
    store: z.string(),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  z.object({
    code: z.literal("delivery_share"),
    currency: CurrencySchema,
    deliveryShareOfSpendPercent: z.number(),
    deliveryTotal: z.number(),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
  z.object({
    code: z.literal("discount_savings"),
    currency: CurrencySchema,
    discountShareOfRawSubtotalPercent: z.number().nullable(),
    discountTotal: z.number(),
    tone: BookOrderStatisticsPulseToneSchema,
  }),
]);

export type BookOrderStatisticsPulseSignal = z.infer<typeof BookOrderStatisticsPulseSignalSchema>;

export const BookOrderStatisticsPulseSchema = z
  .array(BookOrderStatisticsPulseSignalSchema)
  .describe(
    "Deterministic insight codes with typed numeric params. The backend never returns a localized sentence; the frontend maps each code to its own message.",
  );

export type BookOrderStatisticsPulse = z.infer<typeof BookOrderStatisticsPulseSchema>;

export const BOOK_ORDER_STATISTICS_LIMITS = {
  storeMax: 200,
} as const;

export const ActiveMoneyAgeBucketSchema = z.enum([
  "0_7",
  "8_14",
  "15_30",
  "31_plus",
  "unknown_date",
]);

export type ActiveMoneyAgeBucket = z.infer<typeof ActiveMoneyAgeBucketSchema>;

export const ACTIVE_MONEY_AGE_BUCKET_DAYS = {
  "0_7": { maxDays: 7, minDays: 0 },
  "31_plus": { maxDays: null, minDays: 31 },
  "8_14": { maxDays: 14, minDays: 8 },
  "15_30": { maxDays: 30, minDays: 15 },
} as const satisfies Record<
  Exclude<ActiveMoneyAgeBucket, "unknown_date">,
  { maxDays: Nullable<number>; minDays: number }
>;

export const ActiveMoneyAgeQuerySchema = z.object({
  currency: CurrencySchema.optional(),
  store: z.string().trim().max(BOOK_ORDER_STATISTICS_LIMITS.storeMax).optional(),
});

export type ActiveMoneyAgeQuery = z.infer<typeof ActiveMoneyAgeQuerySchema>;

export const ActiveMoneyAgeBucketRowSchema = z.object({
  booksCount: CountSchema,
  key: ActiveMoneyAgeBucketSchema,
  ordersCount: CountSchema,
  shipmentsCount: CountSchema,
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type ActiveMoneyAgeBucketRow = z.infer<typeof ActiveMoneyAgeBucketRowSchema>;

export const ActiveMoneyAgeResponseSchema = z
  .object({
    asOf: z.iso.datetime(),
    buckets: z.array(ActiveMoneyAgeBucketRowSchema),
  })
  .describe(
    "Age of money committed to still-active orders, measured from orderDate against asOf. It ignores the historical from/to filter. The 31_plus bucket is an age fact and carries no delivery-date judgement.",
  );

export type ActiveMoneyAgeResponse = z.infer<typeof ActiveMoneyAgeResponseSchema>;

export const BookOrderStatisticsDaySchema = z.object({
  booksCount: CountSchema,
  date: isoDay(),
  ordersCount: CountSchema,
  totalsByCurrency: z.array(CurrencyTotalSchema),
});

export type BookOrderStatisticsDay = z.infer<typeof BookOrderStatisticsDaySchema>;

export const BookOrderStatisticsDailySchema = z
  .array(BookOrderStatisticsDaySchema)
  .describe(
    "Sparse ascending series: only days that carry at least one counted order are present, days with no activity are omitted rather than sent as zero rows, and the frontend fills the gaps visually.",
  );

export type BookOrderStatisticsDaily = z.infer<typeof BookOrderStatisticsDailySchema>;
