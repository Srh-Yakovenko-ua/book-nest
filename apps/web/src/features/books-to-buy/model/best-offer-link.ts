import type { BestOfferView, BookStoreLinkView, Nullable } from "@app/shared";

import { DEFAULT_CURRENCY } from "@app/shared";

export function findBestOfferLinkId({
  bestOffer,
  storeLinks,
}: {
  bestOffer: Nullable<BestOfferView>;
  storeLinks: BookStoreLinkView[];
}): Nullable<string> {
  if (bestOffer === null) return null;

  const bestOfferLink = storeLinks.find((link) => matchesBestOffer({ bestOffer, link }));
  return bestOfferLink?.id ?? null;
}

function matchesBestOffer({
  bestOffer,
  link,
}: {
  bestOffer: BestOfferView;
  link: BookStoreLinkView;
}): boolean {
  if (link.price === null) return false;
  if (link.price !== bestOffer.price) return false;
  return (link.currency ?? DEFAULT_CURRENCY) === bestOffer.currency;
}
