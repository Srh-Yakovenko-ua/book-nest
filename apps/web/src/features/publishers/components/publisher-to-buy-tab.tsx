"use client";

import type { WishlistBookView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { EmptyState } from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { BooksToBuyRow, useWishlist } from "@/features/books-to-buy";
import { useRouter } from "@/i18n/navigation";

import { publisherPriceLabel } from "../model/publisher-format";

const SKELETON_COUNT = 4;

type CurrencyTotal = {
  amount: number;
  currency: string;
};

type PublisherToBuyTabProps = {
  publisherId: string;
};

export function PublisherToBuyTab({ publisherId }: PublisherToBuyTabProps) {
  const t = useTranslations("publishers.details.toBuyTab");
  const locale = useLocale();
  const router = useRouter();
  const { data, isError, isPending, refetch } = useWishlist();

  if (isError) {
    const errorState: EmptyStateEntry = {
      desc: t("error.description"),
      illu: "error-generic",
      primary: { icon: "refresh", label: t("error.retry") },
      title: t("error.title"),
    };
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={() => void refetch()} state={errorState} />
      </div>
    );
  }

  if (isPending) {
    return (
      <div aria-busy className="flex flex-col gap-2.5">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <Skeleton className="h-20 w-full rounded-xl" key={index} />
        ))}
      </div>
    );
  }

  const books = data.books.filter((book) => book.publisher?.id === publisherId);

  if (books.length === 0) {
    const emptyState: EmptyStateEntry = {
      desc: t("empty.description"),
      illu: "empty-purchases",
      primary: { icon: "plus", label: t("empty.cta") },
      title: t("empty.title"),
    };
    return (
      <EmptyState
        onPrimary={() => router.push(`/books/new?publisherId=${publisherId}`)}
        state={emptyState}
      />
    );
  }

  const totals = currencyTotals(books);
  const withoutPriceCount = books.filter((book) => book.bestOffer === null).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-card">
        <span className="font-medium text-ink">{t("count", { count: books.length })}</span>
        {totals.map((total) => (
          <span className="text-muted-foreground tabular-nums" key={total.currency}>
            {publisherPriceLabel(total.amount, total.currency, locale)}
          </span>
        ))}
        {withoutPriceCount > 0 ? (
          <span className="text-muted-foreground">
            {t("withoutPrice", { count: withoutPriceCount })}
          </span>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2.5">
        {books.map((book) => (
          <li key={book.id}>
            <BooksToBuyRow book={book} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function currencyTotals(books: WishlistBookView[]): CurrencyTotal[] {
  const byCurrency = new Map<string, number>();

  for (const book of books) {
    if (book.bestOffer === null) continue;
    const current = byCurrency.get(book.bestOffer.currency) ?? 0;
    byCurrency.set(book.bestOffer.currency, current + book.bestOffer.price);
  }

  return [...byCurrency.entries()].map(([currency, amount]) => ({ amount, currency }));
}
