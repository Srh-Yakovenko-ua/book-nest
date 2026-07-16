import { z } from "zod";

import { type Currency, CurrencySchema } from "./book-enums.js";
import {
  BookViewSchema,
  OwnershipPriceSchema,
  OwnershipStoreNameSchema,
  OwnershipStoreUrlSchema,
} from "./books.js";
import { type Nullable, type ValueOf } from "./common.js";

export const MAX_STORE_LINKS_PER_BOOK = 20;

const DEFAULT_CURRENCY: Currency = "UAH";

const resolveCurrency = (fields: {
  currency?: Nullable<Currency>;
  price?: Nullable<number>;
}): Nullable<Currency> | undefined =>
  fields.price != null && fields.currency == null ? DEFAULT_CURRENCY : fields.currency;

export const CreateBookStoreLinkInputSchema = z
  .object({
    currency: CurrencySchema.nullable().optional(),
    price: OwnershipPriceSchema.nullable().optional(),
    storeName: OwnershipStoreNameSchema,
    url: OwnershipStoreUrlSchema,
  })
  .transform((value) => ({ ...value, currency: resolveCurrency(value) }));

export type CreateBookStoreLinkInput = z.infer<typeof CreateBookStoreLinkInputSchema>;

export const UpdateBookStoreLinkInputSchema = z
  .object({
    currency: CurrencySchema.nullable().optional(),
    price: OwnershipPriceSchema.nullable().optional(),
    storeName: OwnershipStoreNameSchema.optional(),
    url: OwnershipStoreUrlSchema.optional(),
  })
  .transform((value) => ({ ...value, currency: resolveCurrency(value) }));

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

export const WishlistSummaryViewSchema = z.object({
  booksCount: z.number(),
  estimates: z.array(WishlistCurrencyEstimateSchema),
  trackedStoresCount: z.number(),
});

export type WishlistSummaryView = z.infer<typeof WishlistSummaryViewSchema>;

export const WishlistViewSchema = z.object({
  books: z.array(WishlistBookViewSchema),
  summary: WishlistSummaryViewSchema,
});

export type WishlistView = z.infer<typeof WishlistViewSchema>;

export const STORE_LINK_ERROR_CODES = {
  BOOK_NOT_FOUND: "BOOK_NOT_FOUND",
  DUPLICATE_URL: "DUPLICATE_URL",
  LINK_NOT_FOUND: "LINK_NOT_FOUND",
  MAX_LINKS_REACHED: "MAX_LINKS_REACHED",
  NOT_IN_WISHLIST: "NOT_IN_WISHLIST",
} as const;

export type StoreLinkErrorCode = ValueOf<typeof STORE_LINK_ERROR_CODES>;
