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
  const pricedLinks = links.filter(isPricedStoreLink);
  if (pricedLinks.length === 0) {
    return null;
  }

  const bestLink = pricedLinks.reduce((currentBest, candidate) =>
    isBetterOffer({ candidate, currentBest }) ? candidate : currentBest,
  );

  return {
    currency: resolveOfferCurrency(bestLink.currency),
    price: bestLink.price.toNumber(),
  };
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
