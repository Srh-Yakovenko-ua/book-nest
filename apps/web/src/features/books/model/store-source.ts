import type {
  BestOfferView,
  BookStoreLinkView,
  Currency,
  Nullable,
  PurchaseInfoView,
} from "@app/shared";

import { DEFAULT_CURRENCY } from "@app/shared";
import { z } from "zod";

import { findBestOfferLinkId } from "@/features/books-to-buy/model/best-offer-link";

export const OTHER_STORE_SOURCE = "other";

export const STORE_SOURCE_CURRENCIES = ["UAH", "EUR", "USD"] as const satisfies readonly Currency[];

export const STORE_SOURCE_LIMITS = {
  priceMax: 99999999.99,
  priceMin: 0,
  storeNameMax: 100,
} as const;

export type StoreSourceMessages = {
  price: string;
  priceMax: string;
  storeNameMax: string;
};

export type StoreSourceValue = {
  currency: Currency;
  price: string;
  source: string;
  storeName: string;
};

export function buildStoreSourceSchema(messages: StoreSourceMessages) {
  return z.object({
    currency: z.enum(STORE_SOURCE_CURRENCIES),
    price: z
      .string()
      .refine(
        (value) => value.trim().length === 0 || Number(value) > STORE_SOURCE_LIMITS.priceMin,
        messages.price,
      )
      .refine(
        (value) => value.trim().length === 0 || Number(value) <= STORE_SOURCE_LIMITS.priceMax,
        messages.priceMax,
      ),
    source: z.string(),
    storeName: z.string().max(STORE_SOURCE_LIMITS.storeNameMax, messages.storeNameMax),
  });
}

export function resolveStoreName({
  storeLinks,
  value,
}: {
  storeLinks: BookStoreLinkView[];
  value: StoreSourceValue;
}): string {
  const link = storeLinks.find((item) => item.id === value.source);
  return link === undefined ? value.storeName.trim() : link.storeName;
}

export function resolveStorePrice(value: StoreSourceValue): Nullable<number> {
  if (value.price.trim().length === 0) return null;
  const price = Number(value.price);
  return Number.isFinite(price) ? price : null;
}

export function toStoreSourceDefaults({
  bestOffer,
  purchaseInfo,
  storeLinks,
}: {
  bestOffer: Nullable<BestOfferView>;
  purchaseInfo: Nullable<PurchaseInfoView>;
  storeLinks: BookStoreLinkView[];
}): StoreSourceValue {
  const source =
    findBestOfferLinkId({ bestOffer, storeLinks }) ?? storeLinks[0]?.id ?? OTHER_STORE_SOURCE;
  const link = storeLinks.find((item) => item.id === source) ?? null;

  return {
    ...toStoreSourcePrice({ link, purchaseInfo }),
    source,
    storeName: purchaseInfo?.storeName ?? "",
  };
}

export function toStoreSourcePrice({
  link,
  purchaseInfo,
}: {
  link: Nullable<BookStoreLinkView>;
  purchaseInfo: Nullable<PurchaseInfoView>;
}): Pick<StoreSourceValue, "currency" | "price"> {
  const currency = link === null ? purchaseInfo?.currency : link.currency;
  const price = link === null ? purchaseInfo?.expectedPrice : link.price;

  return {
    currency: currency ?? DEFAULT_CURRENCY,
    price: price == null ? "" : String(price),
  };
}
