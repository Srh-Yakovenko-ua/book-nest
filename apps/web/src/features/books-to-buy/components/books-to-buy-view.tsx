"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { UiIcon } from "@/components/icons";
import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { LibraryActiveFilters, useGenres } from "@/features/books";
import { useTagsSearch } from "@/features/books/api/use-tags-search";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";
import { useRouter } from "@/i18n/navigation";

import { useWishlist } from "../api/use-wishlist";
import { useWishlistFacets } from "../api/use-wishlist-facets";
import { deriveWishlistBestOffers } from "../model/books-to-buy-derive";
import { useWishlistFilterChips } from "../model/use-wishlist-filter-chips";
import { useWishlistQuery } from "../model/use-wishlist-query";
import { BooksToBuyContent } from "./books-to-buy-content";
import { BooksToBuyOverviewPanel } from "./books-to-buy-overview-panel";
import { BooksToBuySidebar } from "./books-to-buy-sidebar";
import { BooksToBuyToolbar, BooksToBuyToolbarSkeleton } from "./books-to-buy-toolbar";

type WishlistSummaryKey = "books" | "missingFromSeries" | "nextInSeries" | "waitingLong";

export function BooksToBuyView() {
  const t = useTranslations("booksToBuy");
  const tUnit = useTranslations("books.library.summary");
  const router = useRouter();
  const wishlist = useWishlistQuery();
  const { data, isError, isPending, refetch } = useWishlist(wishlist.listParams);
  const facets = useWishlistFacets();
  const genres = useGenres();
  const tags = useTagsSearch("");
  const [entityLabels, setEntityLabels] = useState<Record<string, string>>({});

  const allBooks = data?.books ?? [];
  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));
  const tagNameById = new Map((tags.data ?? []).map((tag) => [tag.id, tag.name]));

  function rememberEntity(id: string, name: string) {
    setEntityLabels((prev) => (prev[id] === name ? prev : { ...prev, [id]: name }));
  }

  function resolveEntityName(id: string): string | undefined {
    return entityLabels[id] ?? tagNameById.get(id);
  }

  const storeOptions = (facets.data?.stores ?? []).map((store) => ({
    label: store.name,
    value: store.name,
  }));
  const filterChips = useWishlistFilterChips({
    genreName: (key) => genreNameByKey.get(key) ?? key,
    resolveEntityName,
    setState: wishlist.setState,
    state: wishlist.state,
  });

  const onAddBook = () => router.push("/books/new");
  const showOverview = !isError && (isPending || allBooks.length > 0);
  const hasAnyBooks = allBooks.length > 0 || wishlist.hasActiveFilters || wishlist.hasActiveSearch;

  const bestOffers = deriveWishlistBestOffers(allBooks);
  const summary = data?.summary;
  const summaryLabels = (key: WishlistSummaryKey) => ({
    label: t(`summary.mobile.detailed.${key}`),
    mobileLabels: {
      compact: t(`summary.mobile.compact.${key}`),
      detailed: t(`summary.mobile.detailed.${key}`),
    },
  });

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
              summaryCards={countCards}
            />
          }
          mobileLayout="compact"
        />
      ) : null}

      <ToolbarSlot
        hasAnyBooks={hasAnyBooks}
        isError={isError}
        isPending={isPending}
        toolbar={
          <BooksToBuyToolbar
            activeFilterCount={wishlist.activeFilterCount}
            activeFilters={
              <LibraryActiveFilters chips={filterChips} onClearAll={wishlist.clearAll} />
            }
            counterLabel={t("counter", {
              shown: allBooks.length,
              total: data?.totalBooksCount ?? allBooks.length,
            })}
            onRememberEntity={rememberEntity}
            onSearchChange={wishlist.setSearch}
            onSortChange={wishlist.setSort}
            onViewChange={wishlist.setView}
            resolveEntityName={resolveEntityName}
            setState={wishlist.setState}
            sort={wishlist.sort}
            state={wishlist.state}
            storeOptions={storeOptions}
            view={wishlist.view}
          />
        }
      />

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <BooksToBuyContent
            books={allBooks}
            hasAnyBooks={hasAnyBooks}
            isError={isError}
            isPending={isPending}
            onAddBook={onAddBook}
            onClearFilters={wishlist.clearAll}
            onOpenLibrary={() => router.push("/books")}
            onRetry={() => void refetch()}
            view={wishlist.view}
          />
        </div>
        {showOverview ? <BooksToBuySidebar bestOffers={bestOffers} isLoading={isPending} /> : null}
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
