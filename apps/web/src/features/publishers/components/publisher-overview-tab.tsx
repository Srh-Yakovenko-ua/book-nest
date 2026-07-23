"use client";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookRow,
  LIBRARY_SORT_DEFAULT,
  toLibraryBook,
  useLibraryBookLabels,
  useLibraryBooks,
} from "@/features/books";
import { BooksToBuyRow, useWishlist } from "@/features/books-to-buy";
import { Link } from "@/i18n/navigation";

import { publisherBooksListParams } from "../model/publisher-books-params";

const TO_BUY_PREVIEW_LIMIT = 3;

type PublisherOverviewTabProps = {
  onViewBooks: () => void;
  onViewToBuy: () => void;
  publisherId: string;
};

export function PublisherOverviewTab({
  onViewBooks,
  onViewToBuy,
  publisherId,
}: PublisherOverviewTabProps) {
  const t = useTranslations("publishers.details.overview");
  const labels = useLibraryBookLabels();

  const latestParams = publisherBooksListParams(publisherId, {
    pageSize: 1,
    sort: LIBRARY_SORT_DEFAULT,
  });
  const latest = useLibraryBooks(latestParams);
  const wishlist = useWishlist();

  const latestBook = latest.data?.pages[0]?.items[0];
  const toBuyBooks = (wishlist.data?.books ?? [])
    .filter((book) => book.publisher?.id === publisherId)
    .slice(0, TO_BUY_PREVIEW_LIMIT);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <SectionHeader
          onViewAll={onViewBooks}
          title={t("latestBookTitle")}
          viewAllLabel={t("viewAllBooks")}
        />
        {latest.isPending ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : latestBook === undefined ? (
          <EmptyNote>{t("emptyLatest")}</EmptyNote>
        ) : (
          <BookRow book={toLibraryBook(latestBook, labels)} linkComponent={Link} />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeader
          onViewAll={onViewToBuy}
          title={t("toBuyPreviewTitle")}
          viewAllLabel={t("viewAllToBuy")}
        />
        {wishlist.isPending ? (
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : toBuyBooks.length === 0 ? (
          <EmptyNote>{t("emptyToBuy")}</EmptyNote>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {toBuyBooks.map((book) => (
              <li key={book.id}>
                <BooksToBuyRow book={book} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EmptyNote({ children }: { children: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function SectionHeader({
  onViewAll,
  title,
  viewAllLabel,
}: {
  onViewAll: () => void;
  title: string;
  viewAllLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-heading text-sm font-semibold text-ink">{title}</h2>
      <Button className="h-auto p-0 text-primary" onClick={onViewAll} size="sm" variant="link">
        {viewAllLabel}
        <UiIcon name="arrow-right" size={14} />
      </Button>
    </div>
  );
}
