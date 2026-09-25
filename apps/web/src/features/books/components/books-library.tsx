"use client";

import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { Progress } from "@/components/ui/progress";
import { Link, useRouter } from "@/i18n/navigation";

import type { LibraryScope } from "../model/library-query";

import { useGenres } from "../api/use-genres";
import { useLibraryOverview } from "../api/use-library-overview";
import { BooksArchive } from "./books-archive";
import { LibraryOverviewPanel } from "./library-overview-panel";
import { LibraryPageHeader } from "./library-page-header";
import { type LibrarySummaryCard } from "./library-summary-cards";
import { LibrarySummarySidebar } from "./library-summary-sidebar";

export function BooksLibrary({ scope }: { scope: Exclude<LibraryScope, "favorites"> }) {
  const t = useTranslations("books.library");
  const router = useRouter();

  const overview = useLibraryOverview(scope);
  const genres = useGenres();

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  const onAddBook = () => router.push("/books/new");

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
    const authorsPart = `${authorsCount.toLocaleString()} ${t("summary.unitAuthor", { count: authorsCount })}`;
    if (seriesCount === undefined || seriesCount === 0) {
      return <span className="block truncate max-sm:whitespace-normal">{authorsPart}</span>;
    }
    const seriesPart = `${seriesCount.toLocaleString()} ${t("summary.unitSeries", { count: seriesCount })}`;
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
    const many = `${reading.toLocaleString()} ${bookUnit(reading)} · ${t("summary.readingPagesAhead", { pagesAhead: activeReading.pagesAhead })}`;
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

  const summaryCards: LibrarySummaryCard[] = [
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
    primary: { icon: "plus", label: t(`empty.${scope}.cta`) },
    secondary: scope === "my" ? { icon: "book", label: t("empty.my.secondary") } : undefined,
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
      errorState={errorState}
      header={
        <LibraryPageHeader
          addBookLabel={t("addBook")}
          onAddBook={onAddBook}
          subtitle={t(`${scope}.subtitle`)}
          summaryCards={summaryCards}
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
      onEmptySecondary={scope === "my" ? () => router.push("/books") : undefined}
      scope={scope}
      sidebar={sidebar}
    />
  );
}
