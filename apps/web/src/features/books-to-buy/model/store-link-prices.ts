import type { BookStoreLinkView, Currency, Nullable } from "@app/shared";

import { CurrencySchema, DEFAULT_CURRENCY } from "@app/shared";
import { compareAsc, parseISO } from "date-fns";

export function hasMultipleCurrencies(storeLinks: BookStoreLinkView[]): boolean {
  const currencies = new Set(
    storeLinks
      .filter((link) => link.price !== null)
      .map((link) => link.currency ?? DEFAULT_CURRENCY),
  );

  return currencies.size > 1;
}

export function sortStoreLinksByPrice(storeLinks: BookStoreLinkView[]): BookStoreLinkView[] {
  return [...storeLinks].sort(compareStoreLinks);
}

function compareByCreatedAt(left: BookStoreLinkView, right: BookStoreLinkView): number {
  return compareAsc(parseISO(left.createdAt), parseISO(right.createdAt));
}

function compareStoreLinks(left: BookStoreLinkView, right: BookStoreLinkView): number {
  if (left.price === null || right.price === null) {
    if (left.price === right.price) return compareByCreatedAt(left, right);
    return left.price === null ? 1 : -1;
  }

  const currencyGap = currencyRank(left.currency) - currencyRank(right.currency);
  if (currencyGap !== 0) return currencyGap;
  if (left.price !== right.price) return left.price - right.price;
  return compareByCreatedAt(left, right);
}

function currencyRank(currency: Nullable<Currency>): number {
  return CurrencySchema.options.indexOf(currency ?? DEFAULT_CURRENCY);
}
