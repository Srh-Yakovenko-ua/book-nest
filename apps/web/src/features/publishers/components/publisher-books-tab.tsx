"use client";

import type { ReactNode } from "react";

import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import {
  parseAsArrayOf,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
  useQueryStates,
} from "nuqs";
import { useState } from "react";

import type { EmptyStateEntry } from "@/lib/empty-states";
import type { BooksControllerListSort } from "@/shared/api/generated/model";

import { DebouncedSearchInput } from "@/components/debounced-search-input";
import { EmptyState } from "@/components/empty-state";
import { UiIcon } from "@/components/icons";
import { BookCard } from "@/components/ui/book-card";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookActionDialogs,
  BookCardActions,
  BookRow,
  LIBRARY_PAGE_SIZE,
  LIBRARY_SORT_DEFAULT,
  LIBRARY_SORT_ORDER,
  LIBRARY_STATUS_VALUES,
  type LibraryBook,
  type PendingBookAction,
  toLibraryBook,
  useLibraryActions,
  useLibraryBookLabels,
  useLibraryBooks,
} from "@/features/books";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import { publisherBooksListParams } from "../model/publisher-books-params";

const SKELETON_COUNT = 6;
const VIEW_MODES = ["grid", "list"] as const;

const statusParser = parseAsArrayOf(parseAsStringLiteral(LIBRARY_STATUS_VALUES)).withDefault([]);
const sortParser = parseAsStringLiteral(LIBRARY_SORT_ORDER).withDefault(LIBRARY_SORT_DEFAULT);
const viewParser = parseAsStringLiteral(VIEW_MODES).withDefault("grid");

type PublisherBooksContentProps = {
  books: LibraryBook[];
  hasFilters: boolean;
  hasNextPage: boolean;
  hasSearch: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  isPending: boolean;
  onAddBook: () => void;
  onClearFilters: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  prefersReducedMotion: boolean | null;
  renderActions: (book: LibraryBook) => ReactNode;
  totalCount: number;
  view: (typeof VIEW_MODES)[number];
};

type PublisherBooksTabProps = {
  publisherId: string;
};

export function PublisherBooksTab({ publisherId }: PublisherBooksTabProps) {
  const t = useTranslations("publishers.details.booksTab");
  const tStatus = useTranslations("books.readingStatus.options");
  const tSort = useTranslations("books.library.sort.options");
  const router = useRouter();

  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [{ sort, status }, setState] = useQueryStates({ sort: sortParser, status: statusParser });
  const [view, setView] = useQueryState("view", viewParser);

  const search = q.trim();
  const listParams = publisherBooksListParams(publisherId, {
    pageSize: LIBRARY_PAGE_SIZE,
    sort,
    status,
    ...(search === "" ? {} : { q: search }),
  });

  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isPending, refetch } =
    useLibraryBooks(listParams);

  const labels = useLibraryBookLabels();
  const actions = useLibraryActions();
  const [pending, setPending] = useState<null | PendingBookAction>(null);
  const prefersReducedMotion = useReducedMotion();

  const books: LibraryBook[] = (data?.pages ?? [])
    .flatMap((page) => page.items)
    .map((book) => toLibraryBook(book, labels));
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  const hasFilters = status.length > 0;
  const hasSearch = search !== "";
  const sortOptions = LIBRARY_SORT_ORDER.map((value) => ({ label: tSort(value), value }));

  function toggleStatus(value: (typeof LIBRARY_STATUS_VALUES)[number]) {
    const next = status.includes(value)
      ? status.filter((entry) => entry !== value)
      : [...status, value];
    void setState({ status: next });
  }

  function clearFilters() {
    void setQ(null);
    void setState({ sort: null, status: null });
  }

  const renderActions = (book: LibraryBook) => (
    <BookCardActions actions={actions} book={book} onOpenDialog={setPending} />
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="lg:flex-1">
          <DebouncedSearchInput
            clearLabel={t("searchClear")}
            label={t("searchLabel")}
            onClear={() => void setQ(null)}
            onSearch={(value) => void setQ(value === "" ? null : value)}
            placeholder={t("searchPlaceholder")}
            value={q}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-full sm:w-56">
            <Select
              onValueChange={(next) => void setState({ sort: next as BooksControllerListSort })}
              value={sort}
            >
              <SelectTrigger
                aria-label={t("sortLabel")}
                className="w-full data-[size=default]:h-10"
                isClearable={sort !== LIBRARY_SORT_DEFAULT}
                onClear={() => void setState({ sort: null })}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Segmented
            className="h-10 items-stretch [&_[data-slot=segmented-item]]:py-0"
            label={t("viewLabel")}
            onValueChange={(next) => void setView(next === "list" ? "list" : "grid")}
            options={[
              { icon: <UiIcon name="grip" />, label: t("viewGrid"), value: "grid" },
              { icon: <UiIcon name="list" />, label: t("viewList"), value: "list" },
            ]}
            value={view}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {LIBRARY_STATUS_VALUES.map((value) => {
          const active = status.includes(value);
          return (
            <button
              aria-pressed={active}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                active
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-card text-muted-foreground hover:border-accent-border hover:text-foreground",
              )}
              key={value}
              onClick={() => toggleStatus(value)}
              type="button"
            >
              {tStatus(value)}
            </button>
          );
        })}
      </div>

      <PublisherBooksContent
        books={books}
        hasFilters={hasFilters}
        hasNextPage={hasNextPage}
        hasSearch={hasSearch}
        isError={isError}
        isFetchingNextPage={isFetchingNextPage}
        isPending={isPending}
        onAddBook={() => router.push(`/books/new?publisherId=${publisherId}`)}
        onClearFilters={clearFilters}
        onLoadMore={() => void fetchNextPage()}
        onRetry={() => void refetch()}
        prefersReducedMotion={prefersReducedMotion}
        renderActions={renderActions}
        totalCount={totalCount}
        view={view}
      />

      <BookActionDialogs
        actions={actions}
        onClearSelection={() => setPending(null)}
        onClose={() => setPending(null)}
        pending={pending}
      />
    </div>
  );
}

function PublisherBooksContent({
  books,
  hasFilters,
  hasNextPage,
  hasSearch,
  isError,
  isFetchingNextPage,
  isPending,
  onAddBook,
  onClearFilters,
  onLoadMore,
  onRetry,
  prefersReducedMotion,
  renderActions,
  totalCount,
  view,
}: PublisherBooksContentProps) {
  const t = useTranslations("publishers.details.booksTab");

  if (isError) {
    const errorState: EmptyStateEntry = {
      desc: t("error.description"),
      illu: "error-generic",
      primary: { icon: "refresh", label: t("error.retry") },
      title: t("error.title"),
    };
    return (
      <div aria-live="assertive" role="alert">
        <EmptyState onPrimary={onRetry} state={errorState} />
      </div>
    );
  }

  if (isPending) {
    return (
      <div aria-busy className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <Skeleton className="h-72 w-full rounded-xl" key={index} />
        ))}
      </div>
    );
  }

  if (books.length === 0) {
    if (hasSearch || hasFilters) {
      const noResults: EmptyStateEntry = {
        desc: t("noResults.description"),
        illu: "empty-search",
        primary: { icon: "x", label: t("noResults.clear") },
        title: t("noResults.title"),
      };
      return <EmptyState onPrimary={onClearFilters} state={noResults} />;
    }
    const emptyState: EmptyStateEntry = {
      desc: t("empty.description"),
      illu: "empty-library",
      primary: { icon: "plus", label: t("empty.cta") },
      title: t("empty.title"),
    };
    return <EmptyState onPrimary={onAddBook} state={emptyState} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {t("counter", { shown: books.length, total: totalCount })}
      </p>

      {view === "list" ? (
        <div className="flex flex-col gap-2.5">
          {books.map((book) => (
            <BookRow book={book} kebab={renderActions(book)} key={book.id} linkComponent={Link} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => (
            <motion.div
              className="grid h-full"
              key={book.id}
              transition={{ duration: 0.2, ease: "easeOut" }}
              whileHover={prefersReducedMotion ? undefined : { y: -4 }}
            >
              <BookCard
                ageBadge={book.ageBadge}
                authors={book.authors}
                cover={book.cover}
                formats={book.formats}
                genres={book.genres}
                href={book.href}
                kebab={renderActions(book)}
                linkComponent={Link}
                ownership={book.ownership}
                ownershipTooltip={book.loan?.text}
                progress={book.progress}
                publisher={book.publisher}
                rating={book.rating}
                ratingLabel={book.ratingLabel}
                series={book.series}
                status={book.status}
                tags={book.tags}
                title={book.title}
              />
            </motion.div>
          ))}
        </div>
      )}

      {hasNextPage ? (
        <div className="flex justify-center pt-2">
          <Button
            disabled={isFetchingNextPage}
            loading={isFetchingNextPage}
            onClick={onLoadMore}
            variant="secondary"
          >
            {t("loadMore")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
