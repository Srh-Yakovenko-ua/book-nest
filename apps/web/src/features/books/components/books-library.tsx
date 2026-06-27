"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { Link, useRouter } from "@/i18n/navigation";
import { readingStatuses, type StatusEntry } from "@/lib/book-status";

import type { BooksSortDirection } from "../api/use-books";
import type { LibraryBook } from "./books-library-view";

import { useBooks } from "../api/use-books";
import { useDeleteBook } from "../api/use-delete-book";
import { useGenres } from "../api/use-genres";
import { BooksLibraryView } from "./books-library-view";

const PROGRESS_STATUSES: readonly BookView["readingStatus"][] = ["reading", "paused", "rereading"];

const FALLBACK_STATUS: StatusEntry =
  readingStatuses.find((entry) => entry.value === "not_started") ?? readingStatuses[0];

type LibraryBookLabels = {
  genreName: (key: string) => string;
  progressAriaLabel: (current: number, total: number) => string;
  progressUnit: string;
  ratingLabel: (value: number) => string;
  statusLabel: (value: BookView["readingStatus"]) => string;
};

export function BooksLibrary() {
  const t = useTranslations("books.library");
  const tConfirm = useTranslations("books.deleteConfirm");
  const tCover = useTranslations("books.cover");
  const tDelete = useTranslations("books.delete");
  const tStatus = useTranslations("books.readingStatus.options");
  const router = useRouter();
  const [sortDirection, setSortDirection] = useState<BooksSortDirection>("desc");

  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isPending, refetch } =
    useBooks(sortDirection);
  const deleteBook = useDeleteBook();
  const genres = useGenres();

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  const pages = data?.pages ?? [];
  const totalCount = pages[0]?.totalCount ?? 0;
  const progressUnit = t("progress.unit");
  const books: LibraryBook[] = pages
    .flatMap((page) => page.items)
    .map((book) =>
      toLibraryBook(book, {
        genreName: (key) => genreNameByKey.get(key) ?? key,
        progressAriaLabel: (current, total) => t("progress.ariaLabel", { current, total }),
        progressUnit,
        ratingLabel: (value) => t("rating.ariaLabel", { value }),
        statusLabel: (value) => tStatus(value),
      }),
    );

  const emptyState: EmptyStateEntry = {
    desc: t("empty.description"),
    illu: "empty-library",
    primary: { icon: "plus", label: t("empty.cta") },
    title: t("empty.title"),
  };

  const errorState: EmptyStateEntry = {
    desc: t("error.description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: t("error.retry") },
    secondary: { icon: "plus", label: t("addBook") },
    title: t("error.title"),
  };

  return (
    <BooksLibraryView
      addBookLabel={t("addBook")}
      books={books}
      count={t("count", { count: totalCount })}
      coverViewLabel={tCover("viewer.open")}
      deleteLabels={{
        cancel: tConfirm("cancel"),
        confirm: tConfirm("confirm"),
        deleting: tConfirm("deleting"),
        description: (title) => tConfirm("description", { title }),
        title: tConfirm("title"),
      }}
      emptyState={emptyState}
      errorState={errorState}
      hasNextPage={hasNextPage}
      isDeleting={deleteBook.isPending}
      isError={isError}
      isFetchingNextPage={isFetchingNextPage}
      isPending={isPending}
      linkComponent={Link}
      loadingLabel={t("loading")}
      loadMoreLabel={t("loadMore")}
      menuLabels={{ delete: t("delete"), menu: t("menu") }}
      onAddBook={() => router.push("/books/new")}
      onDeleteBook={(id, onSettled) =>
        deleteBook.mutate(id, {
          onError: () => toast.error(tDelete("error")),
          onSettled,
          onSuccess: () => toast.success(tDelete("success")),
        })
      }
      onLoadMore={() => void fetchNextPage()}
      onRetry={() => void refetch()}
      onSortChange={setSortDirection}
      sortDirection={sortDirection}
      sortLabels={{ label: t("sort.label"), newest: t("sort.newest"), oldest: t("sort.oldest") }}
      title={t("title")}
    />
  );
}

function resolveProgress(book: BookView): undefined | { current: number; total: number } {
  if (!PROGRESS_STATUSES.includes(book.readingStatus)) return undefined;
  const currentPage = book.readingProgress?.currentPage;
  if (book.pagesCount === null || currentPage === null || currentPage === undefined) {
    return undefined;
  }
  return { current: currentPage, total: book.pagesCount };
}

function toLibraryBook(book: BookView, labels: LibraryBookLabels): LibraryBook {
  const baseStatus =
    readingStatuses.find((entry) => entry.value === book.readingStatus) ?? FALLBACK_STATUS;
  const status: StatusEntry = { ...baseStatus, label: labels.statusLabel(book.readingStatus) };
  const firstGenre = book.genres[0];
  const progress = resolveProgress(book);
  const rating = book.readingProgress?.rating ?? undefined;

  return {
    author: book.author.name,
    cover: book.cover ? { alt: book.title, src: book.cover.urls.thumb } : undefined,
    coverMedia: book.cover ?? undefined,
    genre: firstGenre === undefined ? undefined : { label: labels.genreName(firstGenre) },
    href: `/books/${book.id}/edit`,
    id: book.id,
    progress:
      progress === undefined
        ? undefined
        : {
            ...progress,
            ariaLabel: labels.progressAriaLabel(progress.current, progress.total),
            unit: labels.progressUnit,
          },
    rating,
    ratingLabel: rating === undefined ? undefined : labels.ratingLabel(rating),
    series: book.series === null ? undefined : book.series.name,
    status,
    title: book.title,
  };
}
