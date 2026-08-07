"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { MobilePageOverviewLink } from "@/components/ui/mobile-page-overview-panel";
import { Skeleton } from "@/components/ui/skeleton";

import { useUnratedFavorites } from "../api/use-unrated-favorites";
import { ChangeReadingStatusDialog } from "./change-reading-status-dialog";

const VIEW_ALL_HREF = "/favorites?status=finished&hasRating=false";

type FavoritesUnratedBlockProps = {
  unrated: number;
};

export function FavoritesUnratedBlock({ unrated }: FavoritesUnratedBlockProps) {
  const t = useTranslations("favorites.unrated");
  const preview = useUnratedFavorites();
  const [ratingBook, setRatingBook] = useState<BookView | null>(null);

  const books = preview.data?.items ?? [];

  return (
    <>
      {unrated > 0 ? (
        <section className="sidebar-card-leaf flex flex-col gap-4 overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card">
          <header className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-primary">
                <UiIcon aria-hidden name="star" size={16} />
              </span>
              <h2 className="font-heading text-[0.9375rem] font-semibold text-ink">{t("title")}</h2>
              <span
                aria-label={t("countLabel", { count: unrated })}
                className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground tabular-nums"
              >
                {unrated}
              </span>
              {books.length > 0 ? (
                <MobilePageOverviewLink
                  className="group ml-auto inline-flex items-center gap-1 rounded-sm text-xs font-medium text-primary transition-colors outline-none hover:text-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50"
                  href={VIEW_ALL_HREF}
                >
                  {t("viewAll")}
                  <UiIcon
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                    name="arrow-right"
                    size={13}
                  />
                </MobilePageOverviewLink>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
          </header>

          <FavoritesUnratedContent
            books={books}
            isError={preview.isError}
            isLoading={preview.isPending}
            onRate={setRatingBook}
            onRetry={() => void preview.refetch()}
          />
        </section>
      ) : null}

      {ratingBook ? (
        <ChangeReadingStatusDialog
          book={ratingBook}
          defaultStatus="finished"
          onOpenChange={(open) => {
            if (!open) setRatingBook(null);
          }}
          open
        />
      ) : null}
    </>
  );
}

function FavoritesUnratedContent({
  books,
  isError,
  isLoading,
  onRate,
  onRetry,
}: {
  books: BookView[];
  isError: boolean;
  isLoading: boolean;
  onRate: (book: BookView) => void;
  onRetry: () => void;
}) {
  const t = useTranslations("favorites.unrated");

  if (isLoading) {
    return <FavoritesUnratedSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-2" role="status">
        <p className="text-xs text-muted-foreground">{t("error")}</p>
        <Button onClick={onRetry} size="sm" variant="outline">
          <UiIcon name="refresh" size={14} />
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (books.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("emptyAllRated")}</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border">
      {books.map((book) => (
        <FavoritesUnratedRow book={book} key={book.id} onRate={() => onRate(book)} />
      ))}
    </ul>
  );
}

function FavoritesUnratedRow({ book, onRate }: { book: BookView; onRate: () => void }) {
  const t = useTranslations("favorites.unrated");
  const authors = book.authors.map((author) => author.name).join(", ");
  const href = `/books/${book.id}`;

  return (
    <li className="flex min-w-0 gap-3 py-3.5 first:pt-0 last:pb-0">
      <MobilePageOverviewLink className="shrink-0" href={href}>
        <PreviewCover book={book} />
      </MobilePageOverviewLink>
      <div className="flex min-w-0 flex-col justify-between gap-1.5">
        <div>
          <MobilePageOverviewLink className="group min-w-0" href={href}>
            <span className="line-clamp-2 text-sm font-medium text-ink transition-colors group-hover:text-primary">
              {book.title}
            </span>
          </MobilePageOverviewLink>
          {authors.length > 0 ? (
            <span className="truncate text-xs text-muted-foreground">{authors}</span>
          ) : null}
        </div>
        <Button
          aria-label={t("rateBook", { title: book.title })}
          className="self-start"
          onClick={onRate}
          size="sm"
          variant="secondary"
        >
          <UiIcon className="text-primary" name="star" size={13} />
          {t("rate")}
        </Button>
      </div>
    </li>
  );
}

function FavoritesUnratedSkeleton() {
  return (
    <div aria-busy className="flex flex-col divide-y divide-border">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="flex flex-col gap-2.5 py-3.5 first:pt-0 last:pb-0" key={index}>
          <div className="flex gap-3">
            <Skeleton className="aspect-[3/4] w-12 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-0.5">
              <Skeleton className="h-3.5 w-4/5" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-7 w-32 rounded-[min(var(--radius-md),12px)]" />
        </div>
      ))}
    </div>
  );
}

function PreviewCover({ book }: { book: BookView }) {
  const src = book.cover?.urls.card;
  const initial = book.title.trim().charAt(0).toUpperCase();

  return (
    <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-md bg-accent shadow-soft">
      {src === undefined ? (
        <div className="grid h-full w-full place-items-center text-accent-foreground">
          {initial.length === 0 ? (
            <UiIcon name="book" size={18} />
          ) : (
            <span className="font-heading text-lg leading-none font-semibold">{initial}</span>
          )}
        </div>
      ) : (
        <Image alt="" className="object-cover" fill sizes="48px" src={src} unoptimized />
      )}
    </div>
  );
}
