import type {
  BestOfferView,
  Currency,
  Nullable,
  WishlistCurrencyEstimate,
  WishlistSummaryView,
} from "@app/shared";

export function computeWishlistSummary({
  bestOffers,
  storeNames,
}: {
  bestOffers: Nullable<BestOfferView>[];
  storeNames: string[];
}): WishlistSummaryView {
  return {
    booksCount: bestOffers.length,
    estimates: computeEstimates(bestOffers),
    trackedStoresCount: new Set(storeNames).size,
  };
}

function computeEstimates(bestOffers: Nullable<BestOfferView>[]): WishlistCurrencyEstimate[] {
  const pricesByCurrency = new Map<Currency, number[]>();
  for (const offer of bestOffers) {
    if (offer === null) {
      continue;
    }
    const prices = pricesByCurrency.get(offer.currency) ?? [];
    prices.push(offer.price);
    pricesByCurrency.set(offer.currency, prices);
  }

  return [...pricesByCurrency.entries()]
    .map(([currency, prices]) => toEstimate({ currency, prices }))
    .sort((left, right) => left.currency.localeCompare(right.currency));
}

function toEstimate({
  currency,
  prices,
}: {
  currency: Currency;
  prices: number[];
}): WishlistCurrencyEstimate {
  const total = prices.reduce((sum, price) => sum + price, 0);
  return {
    average: total / prices.length,
    best: Math.min(...prices),
    booksCount: prices.length,
    currency,
    total,
  };
}
