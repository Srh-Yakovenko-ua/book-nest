import type { PublisherOverviewWishlistBook } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import { formatStorePrice } from "@/features/books-to-buy/model/format-store-price";

import { PublisherOverviewBookRow } from "./publisher-overview-book-row";
import { PublisherOverviewSection } from "./publisher-overview-section";

type PublisherOverviewWishlistProps = {
  books: PublisherOverviewWishlistBook[];
};

export function PublisherOverviewWishlist({ books }: PublisherOverviewWishlistProps) {
  const t = useTranslations("publishers.details.overview");
  const locale = useLocale();

  return (
    <PublisherOverviewSection title={t("sections.wishlist")}>
      {books.map((book) => (
        <li key={book.id}>
          <PublisherOverviewBookRow book={book}>
            {book.bestOffer === null ? (
              <span className="text-xs text-muted-foreground">{t("noPrice")}</span>
            ) : (
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {formatStorePrice({ ...book.bestOffer, locale })}
              </span>
            )}
          </PublisherOverviewBookRow>
        </li>
      ))}
    </PublisherOverviewSection>
  );
}
