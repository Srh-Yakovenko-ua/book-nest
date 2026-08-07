"use client";

import type { BookView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { LibrarySummaryCard } from "@/features/books/components/library-summary-cards";

import { TitleLeaf } from "@/components/title-leaf";
import { Button } from "@/components/ui/button";
import { useGenres } from "@/features/books/api/use-genres";
import { LibrarySummaryCards } from "@/features/books/components/library-summary-cards";

import { useDedications } from "../api/use-dedications";
import { useDedicationsSummary } from "../api/use-dedications-summary";
import { useDedicationsQuery } from "../model/use-dedications-query";
import { DedicationBookPickerDialog } from "./dedication-book-picker-dialog";
import { DedicationModal } from "./dedication-modal";
import { DedicationsContent } from "./dedications-content";
import { DedicationsOverviewPanel } from "./dedications-overview-panel";
import { DedicationsSidebar } from "./dedications-sidebar";
import { DedicationsToolbar, DedicationsToolbarSkeleton } from "./dedications-toolbar";

const DEDICATIONS_MOBILE_TILE_COUNT = 3;

export function DedicationsView() {
  const t = useTranslations("dedications");
  const query = useDedicationsQuery();
  const dedications = useDedications(query.listParams);
  const summary = useDedicationsSummary();
  const genres = useGenres();

  const [openedBook, setOpenedBook] = useState<Nullable<BookView>>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const books = (dedications.data?.pages ?? []).flatMap((page) => page.items);
  const resultTotal = dedications.data?.pages[0]?.totalCount ?? 0;
  const activeBook =
    openedBook === null ? null : (books.find((book) => book.id === openedBook.id) ?? openedBook);
  const showChrome =
    !dedications.isError && (dedications.isPending || books.length > 0 || query.hasActiveFilters);

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));
  const total = summary.data?.totalCount ?? 0;
  const favorites = summary.data?.favoriteCount ?? 0;
  const finished = summary.data?.finishedCount ?? 0;
  const unfinished = summary.data?.unfinishedCount ?? 0;
  const authorsCount = summary.data?.authorsCount;
  const topGenre = summary.data?.topGenre ?? null;
  const topAuthor = summary.data?.topAuthor ?? null;

  const mobileLabels = (
    key: "favorites" | "fromFinished" | "topAuthor" | "topGenre" | "total",
  ) => ({
    compact: t(`summary.mobile.compact.${key}`),
    detailed: t(`summary.mobile.detailed.${key}`),
  });

  const summaryCards: LibrarySummaryCard[] = [
    {
      icon: "quote",
      iconTone: "primary",
      label: t("summary.total"),
      microfact:
        authorsCount === undefined
          ? undefined
          : t("summary.authorsMicrofact", { count: authorsCount }),
      mobileLabels: mobileLabels("total"),
      unit: t("summary.unit", { count: total }),
      value: total,
    },
    {
      icon: "heart",
      iconTone: "favorite",
      label: t("summary.favorites"),
      microfact:
        total > 0
          ? t("summary.favoritesMicrofact", { percent: Math.round((favorites / total) * 100) })
          : undefined,
      mobileLabels: mobileLabels("favorites"),
      unit: t("summary.unit", { count: favorites }),
      value: favorites,
    },
    {
      icon: "check-circle",
      iconTone: "success",
      label: t("summary.fromFinished"),
      microfact:
        unfinished > 0
          ? t("summary.fromUnfinishedMicrofact", { count: unfinished })
          : t("summary.fromUnfinishedMicrofactNone"),
      mobileLabels: mobileLabels("fromFinished"),
      unit: t("summary.unit", { count: finished }),
      value: finished,
    },
    {
      icon: "tag",
      iconTone: "genre",
      label: t("summary.topGenre"),
      microfact:
        topGenre === null ? undefined : t("summary.topGenreMicrofact", { count: topGenre.count }),
      mobileLabels: mobileLabels("topGenre"),
      value:
        topGenre === null
          ? t("summary.empty")
          : (genreNameByKey.get(topGenre.genre) ?? topGenre.genre),
      valueClassName: "text-lg leading-snug line-clamp-2",
    },
    {
      icon: "user",
      iconTone: "info",
      label: t("summary.topAuthor"),
      microfact:
        topAuthor === null
          ? undefined
          : t("summary.topAuthorMicrofact", { count: topAuthor.count }),
      mobileLabels: mobileLabels("topAuthor"),
      value: topAuthor === null ? t("summary.empty") : topAuthor.name,
      valueClassName: "text-lg leading-snug line-clamp-2",
    },
  ];

  const mobileSummaryCards = summaryCards.slice(0, DEDICATIONS_MOBILE_TILE_COUNT);

  const onChooseBook = () => setPickerOpen(true);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
            {t("title")}
          </h1>
          <TitleLeaf />
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {t("subtitle")}
        </p>
      </header>

      {showChrome ? (
        <LibrarySummaryCards
          cards={summaryCards}
          isLoading={summary.isPending}
          mobileAction={
            <DedicationsOverviewPanel
              isLoading={summary.isPending}
              onChooseBook={onChooseBook}
              summaryCards={summaryCards}
            />
          }
          mobileCards={mobileSummaryCards}
          mobileLayout="compact"
        />
      ) : null}

      <ToolbarSlot
        isPending={dedications.isPending}
        showToolbar={showChrome}
        toolbar={
          <DedicationsToolbar
            availableGenres={summary.data?.availableGenres ?? []}
            chipCounts={
              summary.data === undefined
                ? undefined
                : { all: total, favorites, finished, unfinished }
            }
            counter={
              dedications.isPending || dedications.isError || books.length === 0
                ? undefined
                : t("counter", { shown: books.length, total: resultTotal })
            }
            filter={query.state.filter}
            genre={query.state.genre}
            onFilterChange={query.setFilter}
            onGenreChange={query.setGenre}
            onSearchChange={query.setSearch}
            onSortChange={query.setSort}
            onViewChange={query.setView}
            search={query.state.search}
            sort={query.state.sort}
            view={query.state.view}
          />
        }
      />

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:gap-6">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <DedicationsContent
            books={books}
            hasActiveFilters={query.hasActiveFilters}
            isError={dedications.isError}
            isPending={dedications.isPending}
            isPlaceholderData={dedications.isPlaceholderData}
            onChooseBook={onChooseBook}
            onClearFilters={query.clearFilters}
            onOpenDedication={setOpenedBook}
            onRetry={() => void dedications.refetch()}
            view={query.state.view}
          />
          {books.length === 0 || dedications.isError ? null : (
            <LoadMoreFooter
              hasNextPage={dedications.hasNextPage}
              isFetchingNextPage={dedications.isFetchingNextPage}
              isLoadMoreError={dedications.isFetchNextPageError}
              onLoadMore={() => void dedications.fetchNextPage()}
            />
          )}
        </div>
        {showChrome ? <DedicationsSidebar onChooseBook={onChooseBook} /> : null}
      </div>

      {activeBook === null ? null : (
        <DedicationModal
          book={activeBook}
          onOpenChange={(open) => {
            if (!open) setOpenedBook(null);
          }}
          open
        />
      )}

      <DedicationBookPickerDialog onOpenChange={setPickerOpen} open={pickerOpen} />
    </div>
  );
}

function LoadMoreFooter({
  hasNextPage,
  isFetchingNextPage,
  isLoadMoreError,
  onLoadMore,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoadMoreError: boolean;
  onLoadMore: () => void;
}) {
  const t = useTranslations("dedications");

  return (
    <div className="flex flex-col items-center gap-2 pt-2">
      {hasNextPage ? (
        <>
          {isLoadMoreError ? (
            <p className="text-sm text-error" role="alert">
              {t("loadMoreError")}
            </p>
          ) : null}
          <Button
            disabled={isFetchingNextPage}
            loading={isFetchingNextPage}
            onClick={onLoadMore}
            variant="secondary"
          >
            {t("loadMore")}
          </Button>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">{t("allShown")}</p>
      )}
    </div>
  );
}

function ToolbarSlot({
  isPending,
  showToolbar,
  toolbar,
}: {
  isPending: boolean;
  showToolbar: boolean;
  toolbar: ReactNode;
}) {
  if (isPending) return <DedicationsToolbarSkeleton />;
  if (!showToolbar) return null;
  return toolbar;
}
