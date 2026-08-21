import type { Currency, Nullable, WishlistBookView } from "@app/shared";

import { findBestOfferLinkId } from "./best-offer-link";

export type WishlistBestOffer = {
  bookId: string;
  coverUrl: Nullable<string>;
  currency: Currency;
  price: number;
  storeName: Nullable<string>;
  title: string;
};

export type WishlistFilterOption = {
  label: string;
  value: string;
};

export type WishlistViewMode = "grid" | "list";

export function deriveWishlistBestOffers(books: WishlistBookView[]): WishlistBestOffer[] {
  const offers: WishlistBestOffer[] = [];

  for (const book of books) {
    const offer = toWishlistBestOffer(book);
    if (offer !== null) {
      offers.push(offer);
    }
  }

  return offers.sort((left, right) => left.price - right.price);
}

function toWishlistBestOffer(book: WishlistBookView): Nullable<WishlistBestOffer> {
  const { bestOffer, storeLinks } = book;
  if (bestOffer === null) return null;

  const bestOfferLinkId = findBestOfferLinkId({ bestOffer, storeLinks });

  return {
    bookId: book.id,
    coverUrl: book.cover?.urls.thumb ?? null,
    currency: bestOffer.currency,
    price: bestOffer.price,
    storeName: storeLinks.find((link) => link.id === bestOfferLinkId)?.storeName ?? null,
    title: book.title,
  };
}
