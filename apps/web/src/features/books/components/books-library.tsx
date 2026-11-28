"use client";

import type { ReactNode } from "react";

import { useLocale, useTranslations } from "next-intl";
import { createSerializer } from "nuqs";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { type SummaryCard } from "@/components/catalog/summary-cards";
import { Progress } from "@/components/ui/progress";
import { useGenres } from "@/features/genres";
import { Link, useRouter } from "@/i18n/navigation";
import { collectionChrome } from "@/lib/collection-chrome";
import { formatNumber } from "@/lib/format";
import { BooksControllerListOwnerItem } from "@/shared/api/generated/model";

import type { LibraryScope } from "../model/library-query";

import { useLibraryOverview } from "../api/use-library-overview";
import { useLibraryPresence } from "../api/use-library-presence";
import { BOOK_CREATE_PATH, bookCreateHref } from "../model/book-create-href";
import { libraryQueryParsers } from "../model/library-query";
import { useLibraryQuery } from "../model/use-library-query";
import { BooksArchive } from "./books-archive";
import { LibraryOverviewPanel } from "./library-overview-panel";
import { LibraryPageHeader } from "./library-page-header";
import { LibrarySummarySidebar } from "./library-summary-sidebar";

type BooksLibraryScope = Exclude<LibraryScope, "favorites">;

const serializeLibrary = createSerializer(libraryQueryParsers);

const BOOKS_LIBRARY_LINKS = {
  createBook: {
    all: BOOK_CREATE_PATH,
    my: bookCreateHref({ ownershipStatus: "owned" }),
  } satisfies Record<BooksLibraryScope, string>,
  notOwnedBooks: serializeLibrary("/books", {
    owner: [
      BooksControllerListOwnerItem.none,
      BooksControllerListOwnerItem.want_to_buy,
      BooksControllerListOwnerItem.in_transit,
    ],
  }),
};

export function BooksLibrary({ scope }: { scope: BooksLibraryScope }) {
  const t = useTranslations("books.library");
  const tBooks = useTranslations("books");
  const locale = useLocale();
  const router = useRouter();

  const overview = useLibraryOverview(scope);
  const presence = useLibraryPresence();
  const library = useLibraryQuery(scope);
  const genres = useGenres();

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  const onAddBook = () => router.push(BOOKS_LIBRARY_LINKS.createBook[scope]);
  const offersNotOwnedBooks = scope === "my" && presence.kind === "ready" && presence.total > 0;
  const libraryChrome = collectionChrome({
    baseTotal: overview.data?.summary.total,
    hasQuery: library.hasActiveSearch || library.hasActiveFilters,
  });
  const isEmptyStatePreconditionReady = scope === "all" || presence.kind === "ready";
  const showHeaderAddBook = libraryChrome.showTools || !isEmptyStatePreconditionReady;

  const summary = overview.data?.summary;
  const activeReading = overview.data?.activeReading;
  const total = summary?.total ?? 0;
  const reading = summary?.reading ?? 0;
  const finished = summary?.finished ?? 0;
  const favorites = summary?.favorites ?? 0;

  const bookUnit = (count: number) => t("summary.unitBook", { count });

  const totalMicrofact = ((): ReactNode => {
    const seriesCount = summary?.seriesCount;
    const authorsCount = summary?.authorsCount;
    if (authorsCount === undefined || authorsCount === 0) return undefined;
    const authorsPart = `${formatNumber(authorsCount, locale)} ${t("summary.unitAuthor", { count: authorsCount })}`;
    if (seriesCount === undefined || seriesCount === 0) {
      return <span className="block truncate max-sm:whitespace-normal">{authorsPart}</span>;
    }
    const seriesPart = `${formatNumber(seriesCount, locale)} ${t("summary.unitSeries", { count: seriesCount })}`;
    return (
      <span className="block truncate max-sm:whitespace-normal">{`${seriesPart} · ${authorsPart}`}</span>
    );
  })();

  const readingMicrofact = ((): ReactNode => {
    if (activeReading === undefined) return undefined;
    if (reading === 0)
      return (
        <span className="block truncate max-sm:whitespace-normal">{t("summary.readingNone")}</span>
      );
    if (activeReading.book !== null) {
      const { currentPage, pagesCount } = activeReading.book;
      const percent = pagesCount > 0 ? Math.round((currentPage / pagesCount) * 100) : 0;
      return (
        <div className="flex flex-col gap-1">
          <Progress aria-hidden className="h-1 w-4/5" value={percent} />
          <span className="block truncate max-sm:whitespace-normal">
            {t("summary.readingProgress", { current: currentPage, percent, total: pagesCount })}
          </span>
        </div>
      );
    }
    const many = `${formatNumber(reading, locale)} ${bookUnit(reading)} · ${t("summary.readingPagesAhead", { pagesAhead: activeReading.pagesAhead })}`;
    return <span className="block truncate max-sm:whitespace-normal">{many}</span>;
  })();

  const finishedMicrofact = ((): ReactNode => {
    const physicallyAvailable = summary?.physicallyAvailable;
    if (physicallyAvailable === undefined || physicallyAvailable === 0) return undefined;
    const percent = Math.round((finished / physicallyAvailable) * 100);
    return (
      <span className="block truncate max-sm:whitespace-normal">
        {t("summary.finishedPercent", { percent })}
      </span>
    );
  })();

  const favoritesMicrofact = ((): ReactNode => {
    if (total === 0) return undefined;
    const percent = Math.round((favorites / total) * 100);
    return (
      <span className="block truncate max-sm:whitespace-normal">
        {t("summary.favoritesPercent", { percent })}
      </span>
    );
  })();

  const mobileLabels = (key: "favorites" | "finished" | "reading" | "total") => ({
    compact: t(`summary.mobile.compact.${key}`),
    detailed: t(`summary.mobile.detailed.${key}`),
  });

  const summaryCards: SummaryCard[] = [
    {
      icon: "library",
      iconTone: "primary",
      label: t("summary.total"),
      microfact: totalMicrofact,
      mobileLabels: mobileLabels("total"),
      unit: bookUnit(total),
      value: total,
    },
    {
      icon: "book",
      iconTone: "info",
      label: t("summary.reading"),
      microfact: readingMicrofact,
      mobileLabels: mobileLabels("reading"),
      unit: bookUnit(reading),
      value: reading,
    },
    {
      icon: "check-circle",
      iconTone: "success",
      label: t("summary.finished"),
      microfact: finishedMicrofact,
      mobileLabels: mobileLabels("finished"),
      unit: bookUnit(finished),
      value: finished,
    },
    {
      icon: "heart",
      iconTone: "favorite",
      label: t("summary.favorites"),
      microfact: favoritesMicrofact,
      mobileLabels: mobileLabels("favorites"),
      unit: bookUnit(favorites),
      value: favorites,
    },
  ];

  const emptyState: EmptyStateEntry = {
    desc: t(`empty.${scope}.description`),
    illu: scope === "all" ? "empty-all-books" : "empty-library",
    illuSize: "lg",
    primary: {
      icon: "plus",
      label: scope === "all" ? tBooks("firstBook.cta") : t("empty.my.cta"),
    },
    secondary: offersNotOwnedBooks ? { icon: "book", label: t("empty.my.secondary") } : undefined,
    title: t(`empty.${scope}.title`),
  };

  const errorState: EmptyStateEntry = {
    desc: t("error.description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: t("error.retry") },
    title: t("error.title"),
  };

  const recentlyAdded = (overview.data?.recentlyAdded ?? []).map((book) => ({
    author: book.authors.map((author) => author.name).join(", "),
    href: `/books/${book.id}`,
    id: book.id,
    title: book.title,
  }));

  const topGenres = (overview.data?.topGenres ?? []).map((genre) => ({
    count: genre.count,
    key: genre.key,
    name: genreNameByKey.get(genre.key) ?? genre.name,
  }));

  const topTags = (overview.data?.topTags ?? []).map(({ color, id, name }) => ({
    color,
    id,
    name,
  }));

  const sidebar = (
    <LibrarySummarySidebar
      isLoading={overview.isPending}
      linkComponent={Link}
      recentlyAdded={recentlyAdded}
      topGenres={topGenres}
      topTags={topTags}
    />
  );

  return (
    <BooksArchive
      emptyState={emptyState}
      emptyStatePrecondition={scope === "my" ? presence : undefined}
      errorState={errorState}
      header={
        <LibraryPageHeader
          addBookLabel={t("addBook")}
          onAddBook={showHeaderAddBook ? onAddBook : undefined}
          subtitle={t(`${scope}.subtitle`)}
          summaryCards={libraryChrome.showMetrics ? summaryCards : null}
          summaryError={overview.isLoadingError ? { onRetry: () => void overview.refetch() } : null}
          summaryLoading={overview.isPending}
          summaryMobileAction={
            <LibraryOverviewPanel
              isLoading={overview.isPending}
              recentlyAdded={recentlyAdded}
              summaryCards={summaryCards}
              topGenres={topGenres}
              topTags={topTags}
            />
          }
          summaryMobileLayout="compact"
          title={t(`${scope}.title`)}
        />
      }
      onAddBook={onAddBook}
      onEmptySecondary={
        offersNotOwnedBooks ? () => router.push(BOOKS_LIBRARY_LINKS.notOwnedBooks) : undefined
      }
      scope={scope}
      sidebar={overview.isLoadingError ? undefined : sidebar}
    />
  );
}
