import type { BestOfferView, Currency, Nullable } from "@app/shared";

import { CurrencySchema, DEFAULT_CURRENCY } from "@app/shared";
import { isBefore } from "date-fns";

import type { BookStoreLinkModel } from "../../../generated/prisma/models.js";

type PricedStoreLink = BookStoreLinkModel & { price: NonNullable<BookStoreLinkModel["price"]> };

export function computeBestOffer({
  links,
}: {
  links: BookStoreLinkModel[];
}): Nullable<BestOfferView> {
  const cheapestByCurrency = new Map<Currency, PricedStoreLink>();

  for (const link of links) {
    if (!isPricedStoreLink(link)) {
      continue;
    }
    const currency = resolveOfferCurrency(link.currency);
    const currentBest = cheapestByCurrency.get(currency);
    if (currentBest === undefined || isBetterOffer({ candidate: link, currentBest })) {
      cheapestByCurrency.set(currency, link);
    }
  }

  for (const currency of CurrencySchema.options) {
    const link = cheapestByCurrency.get(currency);
    if (link !== undefined) {
      return { currency, price: link.price.toNumber() };
    }
  }
  return null;
}

function isBetterOffer({
  candidate,
  currentBest,
}: {
  candidate: PricedStoreLink;
  currentBest: PricedStoreLink;
}): boolean {
  const candidatePrice = candidate.price.toNumber();
  const currentBestPrice = currentBest.price.toNumber();
  if (candidatePrice !== currentBestPrice) {
    return candidatePrice < currentBestPrice;
  }
  return isBefore(candidate.createdAt, currentBest.createdAt);
}

function isPricedStoreLink(link: BookStoreLinkModel): link is PricedStoreLink {
  return link.price !== null;
}

function resolveOfferCurrency(currency: Nullable<string>): Currency {
  return currency === null ? DEFAULT_CURRENCY : CurrencySchema.parse(currency);
}
