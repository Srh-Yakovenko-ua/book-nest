import { z } from "zod";

import {
  BookFormatSchema,
  BookLanguageSchema,
  BookTypeSchema,
  type Currency,
  CurrencySchema,
} from "./book-enums.js";
import {
  BookViewSchema,
  LIBRARY_SEARCH_MAX,
  OwnershipPriceSchema,
  OwnershipStoreNameSchema,
  OwnershipStoreUrlSchema,
} from "./books.js";
import { type Nullable, type ValueOf } from "./common.js";
import { GenreKeySchema } from "./genres.js";
import { queryStringArray } from "./internal.js";

export const MAX_STORE_LINKS_PER_BOOK = 20;

export const DEFAULT_CURRENCY: Currency = "UAH";

const StoreLinkStoreNameSchema = OwnershipStoreNameSchema.refine(
  (value) => value.length > 0,
  "Store name is required",
);

const resolveCurrency = (fields: {
  currency?: Nullable<Currency>;
  price?: Nullable<number>;
}): Nullable<Currency> | undefined =>
  fields.price != null && fields.currency == null ? DEFAULT_CURRENCY : fields.currency;

export const CreateBookStoreLinkInputSchema = z
  .object({
    currency: CurrencySchema.nullable().optional(),
    price: OwnershipPriceSchema.nullable().optional(),
    storeName: StoreLinkStoreNameSchema,
    url: OwnershipStoreUrlSchema,
  })
  .transform((value) => ({ ...value, currency: resolveCurrency(value) }));

export type CreateBookStoreLinkInput = z.infer<typeof CreateBookStoreLinkInputSchema>;

export const WantToBuyInputSchema = z.object({
  storeLink: CreateBookStoreLinkInputSchema.optional(),
});

export type WantToBuyInput = z.infer<typeof WantToBuyInputSchema>;

export const UpdateBookStoreLinkInputSchema = z.object({
  currency: CurrencySchema.nullable().optional(),
  price: OwnershipPriceSchema.nullable().optional(),
  storeName: StoreLinkStoreNameSchema.optional(),
  url: OwnershipStoreUrlSchema.optional(),
});

export type UpdateBookStoreLinkInput = z.infer<typeof UpdateBookStoreLinkInputSchema>;

export const BookStoreLinkViewSchema = z.object({
  bookId: z.string(),
  createdAt: z.string(),
  currency: CurrencySchema.nullable(),
  id: z.string(),
  price: z.number().nullable(),
  storeName: z.string(),
  updatedAt: z.string(),
  url: z.string(),
});

export type BookStoreLinkView = z.infer<typeof BookStoreLinkViewSchema>;

export const BestOfferViewSchema = z.object({
  currency: CurrencySchema,
  price: z.number(),
});

export type BestOfferView = z.infer<typeof BestOfferViewSchema>;

export const BookStoreLinksViewSchema = z.object({
  bestOffer: BestOfferViewSchema.nullable(),
  storeLinks: z.array(BookStoreLinkViewSchema),
});

export type BookStoreLinksView = z.infer<typeof BookStoreLinksViewSchema>;

export const WishlistBookViewSchema = BookViewSchema.extend({
  bestOffer: BestOfferViewSchema.nullable(),
  storeLinks: z.array(BookStoreLinkViewSchema),
});

export type WishlistBookView = z.infer<typeof WishlistBookViewSchema>;

export const WishlistCurrencyEstimateSchema = z.object({
  average: z.number(),
  best: z.number(),
  booksCount: z.number(),
  currency: CurrencySchema,
  total: z.number(),
});

export type WishlistCurrencyEstimate = z.infer<typeof WishlistCurrencyEstimateSchema>;

export const WishlistSeriesBreakdownSchema = z.object({
  booksCount: z.number(),
  seriesCount: z.number(),
});

export type WishlistSeriesBreakdown = z.infer<typeof WishlistSeriesBreakdownSchema>;

export const WishlistCountsViewSchema = z.object({
  addedLast30Days: z.number(),
  missingFromSeries: WishlistSeriesBreakdownSchema,
  nextInSeries: WishlistSeriesBreakdownSchema,
  waitingOverSixMonths: z.number(),
});

export type WishlistCountsView = z.infer<typeof WishlistCountsViewSchema>;

export const WishlistSummaryViewSchema = z.object({
  booksCount: z.number(),
  counts: WishlistCountsViewSchema,
  estimates: z.array(WishlistCurrencyEstimateSchema),
  trackedStoresCount: z.number(),
});

export type WishlistSummaryView = z.infer<typeof WishlistSummaryViewSchema>;

export const WishlistViewSchema = z.object({
  books: z.array(WishlistBookViewSchema),
  summary: WishlistSummaryViewSchema,
  totalBooksCount: z.number(),
});

export type WishlistView = z.infer<typeof WishlistViewSchema>;

export const WishlistStoreFacetSchema = z.object({
  count: z.number().int().nonnegative(),
  name: z.string(),
});

export type WishlistStoreFacet = z.infer<typeof WishlistStoreFacetSchema>;

export const WishlistFacetsViewSchema = z.object({
  stores: z.array(WishlistStoreFacetSchema),
});

export type WishlistFacetsView = z.infer<typeof WishlistFacetsViewSchema>;

export const WishlistSortSchema = z.enum([
  "added_asc",
  "added_desc",
  "author_asc",
  "price_asc",
  "price_desc",
  "publisher_asc",
  "stores_desc",
  "title_asc",
]);

export type WishlistSort = z.infer<typeof WishlistSortSchema>;

export const WISHLIST_SORT_DEFAULT: WishlistSort = "added_asc";

export const WishlistLinkFilterSchema = z.enum([
  "has_links",
  "without_links",
  "has_price",
  "without_price",
]);
export const WishlistAgeFilterSchema = z.enum(["recent", "middle", "long"]);
export const WishlistSeriesPlacementSchema = z.enum(["gap", "continuation"]);

export const WishlistQuerySchema = z
  .object({
    age: queryStringArray(WishlistAgeFilterSchema),
    author: queryStringArray(z.uuid()),
    bookType: BookTypeSchema.optional(),
    currency: queryStringArray(CurrencySchema),
    format: queryStringArray(BookFormatSchema),
    genre: queryStringArray(GenreKeySchema),
    hasCover: z.stringbool().optional(),
    isFavorite: z.stringbool().optional(),
    language: queryStringArray(BookLanguageSchema),
    link: WishlistLinkFilterSchema.optional(),
    pagesMax: z.coerce.number().int().nonnegative().optional(),
    pagesMin: z.coerce.number().int().nonnegative().optional(),
    priceCurrency: CurrencySchema.optional(),
    priceMax: z.coerce.number().nonnegative().optional(),
    priceMin: z.coerce.number().nonnegative().optional(),
    publisher: queryStringArray(z.uuid()),
    q: z.string().trim().max(LIBRARY_SEARCH_MAX).optional(),
    seriesPlacement: queryStringArray(WishlistSeriesPlacementSchema),
    sort: WishlistSortSchema.default(WISHLIST_SORT_DEFAULT),
    store: queryStringArray(StoreLinkStoreNameSchema),
    tag: queryStringArray(z.uuid()),
    yearMax: z.coerce.number().int().optional(),
    yearMin: z.coerce.number().int().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.pagesMin !== undefined &&
      value.pagesMax !== undefined &&
      value.pagesMin > value.pagesMax
    ) {
      context.addIssue({
        code: "custom",
        message: "pagesMin must not exceed pagesMax",
        path: ["pagesMin"],
      });
    }
    if (
      value.priceMin !== undefined &&
      value.priceMax !== undefined &&
      value.priceMin > value.priceMax
    ) {
      context.addIssue({
        code: "custom",
        message: "priceMin must not exceed priceMax",
        path: ["priceMin"],
      });
    }
    if (
      (value.priceMin !== undefined || value.priceMax !== undefined) &&
      value.priceCurrency === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "priceCurrency is required for a price range",
        path: ["priceCurrency"],
      });
    }
    if (
      value.yearMin !== undefined &&
      value.yearMax !== undefined &&
      value.yearMin > value.yearMax
    ) {
      context.addIssue({
        code: "custom",
        message: "yearMin must not exceed yearMax",
        path: ["yearMin"],
      });
    }
  });

export type WishlistQuery = z.infer<typeof WishlistQuerySchema>;

export const STORE_LINK_ERROR_CODES = {
  BOOK_NOT_FOUND: "BOOK_NOT_FOUND",
  DUPLICATE_URL: "DUPLICATE_URL",
  LINK_NOT_FOUND: "LINK_NOT_FOUND",
  MAX_LINKS_REACHED: "MAX_LINKS_REACHED",
  NOT_IN_WISHLIST: "NOT_IN_WISHLIST",
} as const;

export type StoreLinkErrorCode = ValueOf<typeof STORE_LINK_ERROR_CODES>;
