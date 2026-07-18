"use client";

import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useGenres } from "@/features/books";
import { useRouter } from "@/i18n/navigation";

import type { WishlistFilters, WishlistSort } from "../model/books-to-buy-derive";

import { useWishlist } from "../api/use-wishlist";
import {
  buildWishlistFilterOptions,
  deriveWishlistBestOffers,
  deriveWishlistBooks,
  WISHLIST_FILTERS_DEFAULT,
  WISHLIST_SORT_DEFAULT,
} from "../model/books-to-buy-derive";
import { BooksToBuyContent } from "./books-to-buy-content";
import { BooksToBuySidebar } from "./books-to-buy-sidebar";
import { BooksToBuyToolbar, BooksToBuyToolbarSkeleton } from "./books-to-buy-toolbar";

export function BooksToBuyView() {
  const t = useTranslations("booksToBuy");
  const locale = useLocale();
  const router = useRouter();
  const { data, isError, isPending, refetch } = useWishlist();
  const genres = useGenres();

  const [filters, setFilters] = useState<WishlistFilters>(WISHLIST_FILTERS_DEFAULT);
  const [sort, setSort] = useState<WishlistSort>(WISHLIST_SORT_DEFAULT);

  const allBooks = data?.books ?? [];
  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));
  const filterOptions = buildWishlistFilterOptions({ books: allBooks, genreNameByKey, locale });
  const { linkFilterCounts, visibleBooks } = deriveWishlistBooks({
    books: allBooks,
    filters,
    genreNameByKey,
    locale,
    sort,
  });

  const onAddBook = () => router.push("/books/new");
  const showSidebar = !isError && (isPending || allBooks.length > 0);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
            {data ? (
              <Badge variant="secondary">
                {t("countBadge", { count: data.summary.booksCount })}
              </Badge>
            ) : null}
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            {t("subtitle")}
          </p>
        </div>
        <Button className="self-start sm:self-auto" onClick={onAddBook}>
          <UiIcon name="plus" size={16} />
          {t("addBook")}
        </Button>
      </header>

      <ToolbarSlot
        hasAnyBooks={allBooks.length > 0}
        isError={isError}
        isPending={isPending}
        toolbar={
          <BooksToBuyToolbar
            filters={filters}
            linkFilterCounts={linkFilterCounts}
            onFiltersChange={setFilters}
            onSortChange={setSort}
            options={filterOptions}
            sort={sort}
          />
        }
      />

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <BooksToBuyContent
            books={visibleBooks}
            hasAnyBooks={allBooks.length > 0}
            isError={isError}
            isPending={isPending}
            onAddBook={onAddBook}
            onClearFilters={() => setFilters(WISHLIST_FILTERS_DEFAULT)}
            onOpenLibrary={() => router.push("/books")}
            onRetry={() => void refetch()}
          />
        </div>
        {showSidebar ? (
          <BooksToBuySidebar
            bestOffers={deriveWishlistBestOffers(allBooks)}
            isLoading={isPending}
            onShowBestOffers={() => setSort("price_asc")}
            summary={data?.summary}
          />
        ) : null}
      </div>
    </div>
  );
}

function ToolbarSlot({
  hasAnyBooks,
  isError,
  isPending,
  toolbar,
}: {
  hasAnyBooks: boolean;
  isError: boolean;
  isPending: boolean;
  toolbar: ReactNode;
}) {
  if (isError) return null;
  if (isPending) return <BooksToBuyToolbarSkeleton />;
  if (!hasAnyBooks) return null;
  return toolbar;
}
