"use client";

import type { BookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Link, useRouter } from "@/i18n/navigation";
import { readingStatuses, type StatusEntry } from "@/lib/book-status";

import type { BooksSortDirection } from "../api/use-books";
import type { LibraryBook } from "./books-library-view";

import { useBooks } from "../api/use-books";
import { useDeleteBook } from "../api/use-delete-book";
import { BooksLibraryView } from "./books-library-view";

const PROGRESS_STATUSES: readonly BookView["readingStatus"][] = ["reading", "paused", "rereading"];

const FALLBACK_STATUS: StatusEntry =
  readingStatuses.find((entry) => entry.value === "not_started") ?? readingStatuses[0];

export function BooksLibrary() {
  const t = useTranslations("books.library");
  const tConfirm = useTranslations("books.deleteConfirm");
  const tDelete = useTranslations("books.delete");
  const tGenre = useTranslations("books.classification.genreLabels");
  const router = useRouter();
  const [sortDirection, setSortDirection] = useState<BooksSortDirection>("desc");

  const { data, fetchNextPage, hasNextPage, isError, isFetchingNextPage, isPending, refetch } =
    useBooks(sortDirection);
  const deleteBook = useDeleteBook();

  const pages = data?.pages ?? [];
  const totalCount = pages[0]?.totalCount ?? 0;
  const books: LibraryBook[] = pages
    .flatMap((page) => page.items)
    .map((book) => toLibraryBook(book, tGenre));

  return (
    <BooksLibraryView
      addBookLabel={t("addBook")}
      books={books}
      count={t("count", { count: totalCount })}
      deleteLabels={{
        cancel: tConfirm("cancel"),
        confirm: tConfirm("confirm"),
        deleting: tConfirm("deleting"),
        description: (title) => tConfirm("description", { title }),
        title: tConfirm("title"),
      }}
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

function toLibraryBook(
  book: BookView,
  tGenre: ReturnType<typeof useTranslations<"books.classification.genreLabels">>,
): LibraryBook {
  const status =
    readingStatuses.find((entry) => entry.value === book.readingStatus) ?? FALLBACK_STATUS;
  const firstGenre = book.genres[0];

  return {
    author: book.author.name,
    genre: firstGenre === undefined ? undefined : { label: tGenre(firstGenre) },
    href: `/books/${book.id}/edit`,
    id: book.id,
    progress: resolveProgress(book),
    rating: book.readingProgress?.rating ?? undefined,
    series: book.series === null ? undefined : book.series.name,
    status,
    title: book.title,
  };
}
