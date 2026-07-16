"use client";

import type { BookView, DedicationsSummaryView, Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { TitleLeaf } from "@/components/title-leaf";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "@/i18n/navigation";

import type { DedicationsSummaryState } from "./dedications-sidebar";

import { useDedications } from "../api/use-dedications";
import { useDedicationsSummary } from "../api/use-dedications-summary";
import { useDedicationsQuery } from "../model/use-dedications-query";
import { DedicationModal } from "./dedication-modal";
import { DedicationsContent } from "./dedications-content";
import { DedicationsPagination } from "./dedications-pagination";
import { DedicationsSidebar } from "./dedications-sidebar";
import { DedicationsToolbar, DedicationsToolbarSkeleton } from "./dedications-toolbar";

export function DedicationsView() {
  const t = useTranslations("dedications");
  const router = useRouter();
  const query = useDedicationsQuery();
  const dedications = useDedications(query.listParams);
  const summary = useDedicationsSummary();

  const [openedBook, setOpenedBook] = useState<Nullable<BookView>>(null);

  const books = dedications.data?.items ?? [];
  const activeBook =
    openedBook === null ? null : (books.find((book) => book.id === openedBook.id) ?? openedBook);
  const summaryState = resolveSummaryState({ data: summary.data, isError: summary.isError });
  const showChrome =
    !dedications.isError && (dedications.isPending || books.length > 0 || query.hasActiveFilters);

  const onAddBook = () => router.push("/books/new");
  const onOpenLibrary = () => router.push("/books");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-heading text-[clamp(1.875rem,4vw,2.75rem)] leading-tight font-semibold text-ink">
            {t("title")}
          </h1>
          <TitleLeaf />
          {summary.data === undefined ? null : (
            <Badge variant="secondary">{t("countBadge", { count: summary.data.totalCount })}</Badge>
          )}
        </div>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
          {t("subtitle")}
        </p>
      </header>

      <ToolbarSlot
        isPending={dedications.isPending}
        showToolbar={showChrome}
        toolbar={
          <DedicationsToolbar
            availableGenres={summary.data?.availableGenres ?? []}
            filter={query.state.filter}
            genre={query.state.genre}
            onFilterChange={query.setFilter}
            onGenreChange={query.setGenre}
            onSearchChange={query.setSearch}
            onSortChange={query.setSort}
            search={query.state.search}
            sort={query.state.sort}
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
            onAddBook={onAddBook}
            onClearFilters={query.clearFilters}
            onOpenDedication={setOpenedBook}
            onOpenLibrary={onOpenLibrary}
            onRetry={() => void dedications.refetch()}
          />
          {dedications.data === undefined || books.length === 0 ? null : (
            <DedicationsPagination
              onPageChange={query.setPage}
              page={query.state.page}
              pagesCount={dedications.data.pagesCount}
            />
          )}
        </div>
        {showChrome ? (
          <DedicationsSidebar
            filter={query.state.filter}
            onQuickFilter={query.setFilter}
            onRetrySummary={() => void summary.refetch()}
            summaryState={summaryState}
          />
        ) : null}
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
    </div>
  );
}

function resolveSummaryState({
  data,
  isError,
}: {
  data: DedicationsSummaryView | undefined;
  isError: boolean;
}): DedicationsSummaryState {
  if (isError) return { kind: "error" };
  if (data === undefined) return { kind: "loading" };
  return { kind: "ready", summary: data };
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
