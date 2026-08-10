"use client";

import type { Nullable, WishlistCurrencyEstimate, WishlistSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";
import type { BooksControllerWishlistParams } from "@/shared/api/generated/model";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { useGenres } from "@/features/books";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";
import { useRouter } from "@/i18n/navigation";

import type { WishlistFilters, WishlistSort, WishlistViewMode } from "../model/books-to-buy-derive";

import { useWishlist } from "../api/use-wishlist";
import {
  buildWishlistFilterOptions,
  deriveWishlistBestOffers,
  deriveWishlistBooks,
  WISHLIST_FILTERS_DEFAULT,
  WISHLIST_SORT_DEFAULT,
} from "../model/books-to-buy-derive";
import { formatStorePrice } from "../model/format-store-price";
import { BooksToBuyContent } from "./books-to-buy-content";
import { BooksToBuyOverviewPanel } from "./books-to-buy-overview-panel";
import { BooksToBuySidebar } from "./books-to-buy-sidebar";
import { BooksToBuyToolbar, BooksToBuyToolbarSkeleton } from "./books-to-buy-toolbar";

const WISHLIST_MOBILE_TILE_COUNT = 3;

type WishlistSummaryKey =
  | "average"
  | "best"
  | "books"
  | "missingFromSeries"
  | "nextInSeries"
  | "stores"
  | "total"
  | "waitingLong";

export function BooksToBuyView() {
  const t = useTranslations("booksToBuy");
  const tUnit = useTranslations("books.library.summary");
  const locale = useLocale();
  const router = useRouter();
  const [filters, setFilters] = useState<WishlistFilters>(WISHLIST_FILTERS_DEFAULT);
  const [filterOptions, setFilterOptions] = useState(() =>
    buildWishlistFilterOptions({ books: [], genreNameByKey: new Map(), locale }),
  );
  const [sort, setSort] = useState<WishlistSort>(WISHLIST_SORT_DEFAULT);
  const [view, setView] = useState<WishlistViewMode>("grid");
  const { data, isError, isPending, refetch } = useWishlist(toWishlistParams(filters));
  const genres = useGenres();

  const allBooks = data?.books ?? [];
  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));
  const responseFilterOptions = buildWishlistFilterOptions({
    books: allBooks,
    genreNameByKey,
    locale,
  });
  useEffect(() => {
    setFilterOptions((current) => mergeFilterOptions(current, responseFilterOptions, locale));
  }, [data, genres.data, locale]);
  const { visibleBooks } = deriveWishlistBooks({
    books: allBooks,
    filters,
    genreNameByKey,
    locale,
    sort,
  });

  const onAddBook = () => router.push("/books/new");
  const showOverview = !isError && (isPending || allBooks.length > 0);

  const bestOffers = deriveWishlistBestOffers(allBooks);
  const summary = data?.summary;
  const estimate = primaryEstimate(summary);
  const summaryLabels = (key: WishlistSummaryKey) => ({
    label: t(`summary.mobile.detailed.${key}`),
    mobileLabels: {
      compact: t(`summary.mobile.compact.${key}`),
      detailed: t(`summary.mobile.detailed.${key}`),
    },
  });
  const estimateMicrofact =
    estimate === null || !spansSeveralCurrencies({ estimate, summary })
      ? undefined
      : t("sidebar.stats.currencyGroup", {
          count: estimate.booksCount,
          currency: estimate.currency,
        });
  const price = (pick: (estimate: WishlistCurrencyEstimate) => number) =>
    estimate === null
      ? t("summary.empty")
      : formatStorePrice({ currency: estimate.currency, locale, price: pick(estimate) });

  const counts = summary?.counts;
  const bookUnit = (count: number) => tUnit("unitBook", { count });

  const totalCount = summary?.booksCount ?? 0;
  const missingCount = counts?.missingFromSeries.booksCount ?? 0;
  const nextCount = counts?.nextInSeries.booksCount ?? 0;
  const waitingCount = counts?.waitingOverSixMonths ?? 0;

  const countCards: LibrarySummaryCard[] = [
    {
      ...summaryLabels("books"),
      icon: "cart",
      iconTone: "primary",
      microfact: t("summary.microfact.addedLast30Days", { count: counts?.addedLast30Days ?? 0 }),
      unit: bookUnit(totalCount),
      value: totalCount,
    },
    {
      ...summaryLabels("missingFromSeries"),
      icon: "book-x",
      iconTone: "info",
      microfact: t("summary.microfact.missingFromSeries", {
        count: counts?.missingFromSeries.seriesCount ?? 0,
      }),
      unit: bookUnit(missingCount),
      value: missingCount,
    },
    {
      ...summaryLabels("nextInSeries"),
      icon: "layers",
      iconTone: "genre",
      microfact: t("summary.microfact.nextInSeries", {
        count: counts?.nextInSeries.seriesCount ?? 0,
      }),
      unit: bookUnit(nextCount),
      value: nextCount,
    },
    {
      ...summaryLabels("waitingLong"),
      icon: "clock",
      iconTone: "ink",
      microfact: t("summary.microfact.overSixMonths"),
      unit: bookUnit(waitingCount),
      value: waitingCount,
    },
  ];

  const priceCards: LibrarySummaryCard[] = [
    {
      ...summaryLabels("stores"),
      icon: "store",
      iconTone: "info",
      value: summary?.trackedStoresCount ?? 0,
    },
    {
      ...summaryLabels("best"),
      icon: "tag",
      iconTone: "success",
      microfact: estimateMicrofact,
      value: price((current) => current.best),
    },
    {
      ...summaryLabels("average"),
      icon: "chart",
      iconTone: "genre",
      microfact: estimateMicrofact,
      value: price((current) => Math.round(current.average)),
    },
    {
      ...summaryLabels("total"),
      icon: "wallet",
      iconTone: "ink",
      microfact: estimateMicrofact,
      value: price((current) => current.total),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
              {t("title")}
            </h1>
            <TitleLeaf />
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

      {showOverview ? (
        <LibrarySummaryCards
          cards={countCards}
          isLoading={isPending}
          mobileAction={
            <BooksToBuyOverviewPanel
              bestOffers={bestOffers}
              isLoading={isPending}
              onShowBestOffers={() => setSort("price_asc")}
              summaryCards={[...countCards, ...priceCards]}
            />
          }
          mobileCards={countCards.slice(0, WISHLIST_MOBILE_TILE_COUNT)}
          mobileLayout="compact"
        />
      ) : null}

      <ToolbarSlot
        hasAnyBooks={allBooks.length > 0 || hasActiveWishlistFilters(filters)}
        isError={isError}
        isPending={isPending}
        toolbar={
          <BooksToBuyToolbar
            counterLabel={t("counter", {
              shown: visibleBooks.length,
              total: data?.totalBooksCount ?? visibleBooks.length,
            })}
            filters={filters}
            onFiltersChange={setFilters}
            onSortChange={setSort}
            onViewChange={setView}
            options={filterOptions}
            sort={sort}
            view={view}
          />
        }
      />

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <BooksToBuyContent
            books={visibleBooks}
            hasAnyBooks={allBooks.length > 0 || hasActiveWishlistFilters(filters)}
            isError={isError}
            isPending={isPending}
            onAddBook={onAddBook}
            onClearFilters={() => setFilters(WISHLIST_FILTERS_DEFAULT)}
            onOpenLibrary={() => router.push("/books")}
            onRetry={() => void refetch()}
            view={view}
          />
        </div>
        {showOverview ? (
          <BooksToBuySidebar
            bestOffers={bestOffers}
            isLoading={isPending}
            onShowBestOffers={() => setSort("price_asc")}
          />
        ) : null}
      </div>
    </div>
  );
}

function hasActiveWishlistFilters(filters: WishlistFilters): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.link !== "all" ||
    filters.storeName !== null ||
    filters.publisherId !== null ||
    filters.genreKey !== null ||
    filters.tagId !== null
  );
}

function mergeFilterOptions(
  current: ReturnType<typeof buildWishlistFilterOptions>,
  next: ReturnType<typeof buildWishlistFilterOptions>,
  locale: string,
): ReturnType<typeof buildWishlistFilterOptions> {
  const merge = (left: typeof current.genres, right: typeof current.genres) =>
    [...new Map([...left, ...right].map((option) => [option.value, option])).values()].sort(
      (a, b) => a.label.localeCompare(b.label, locale),
    );
  return {
    genres: merge(current.genres, next.genres),
    publishers: merge(current.publishers, next.publishers),
    stores: merge(current.stores, next.stores),
    tags: merge(current.tags, next.tags),
  };
}

function primaryEstimate(
  summary: undefined | WishlistSummaryView,
): Nullable<WishlistCurrencyEstimate> {
  const [first, ...rest] = summary?.estimates ?? [];
  if (first === undefined) return null;
  return rest.reduce(
    (leader, candidate) => (candidate.booksCount > leader.booksCount ? candidate : leader),
    first,
  );
}

function spansSeveralCurrencies({
  estimate,
  summary,
}: {
  estimate: WishlistCurrencyEstimate;
  summary: undefined | WishlistSummaryView;
}): boolean {
  if (summary === undefined) return false;
  return summary.estimates.length > 1 || estimate.booksCount < summary.booksCount;
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

function toWishlistParams(filters: WishlistFilters): BooksControllerWishlistParams {
  return {
    genre: filters.genreKey === null ? undefined : [filters.genreKey],
    link: filters.link === "all" ? undefined : filters.link,
    publisher: filters.publisherId === null ? undefined : [filters.publisherId],
    q: filters.search.trim() || undefined,
    store: filters.storeName === null ? undefined : [filters.storeName],
    tag: filters.tagId === null ? undefined : [filters.tagId],
  };
}
