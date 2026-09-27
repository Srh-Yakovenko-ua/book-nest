"use client";

import { useTranslations } from "next-intl";

import type { EmptyStateEntry } from "@/lib/empty-states";

import { BooksArchive } from "@/features/books";

type PublisherBooksTabProps = {
  onAddBook: () => void;
  publisherId: string;
};

export function PublisherBooksTab({ onAddBook, publisherId }: PublisherBooksTabProps) {
  const t = useTranslations("publishers.details.booksTab");

  const emptyState: EmptyStateEntry = {
    desc: t("empty.description"),
    illu: "empty-all-books",
    illuSize: "lg",
    primary: { icon: "plus", label: t("empty.cta") },
    title: t("empty.title"),
  };

  const errorState: EmptyStateEntry = {
    desc: t("error.description"),
    illu: "error-generic",
    primary: { icon: "refresh", label: t("error.retry") },
    title: t("error.title"),
  };

  return (
    <BooksArchive
      emptyState={emptyState}
      errorState={errorState}
      onAddBook={onAddBook}
      publisherContext={{ publisherId }}
      scope="all"
    />
  );
}
