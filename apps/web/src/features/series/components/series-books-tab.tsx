"use client";

import type { SeriesDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { duplicatePartNumbers, seriesBooksInReadingOrder } from "../model/series-details-derive";
import { SeriesBookCard } from "./series-book-card";
import { SeriesReadingOrder } from "./series-reading-order";

type SeriesBooksTabProps = {
  details: SeriesDetailsView;
  onAddBook: () => void;
};

export function SeriesBooksTab({ details, onAddBook }: SeriesBooksTabProps) {
  const t = useTranslations("series.details");

  if (details.books.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-accent text-icon">
          <UiIcon name="book" size={24} />
        </span>
        <p className="text-sm font-medium text-ink">{t("booksEmpty.title")}</p>
        <Button onClick={onAddBook}>
          <UiIcon name="plus" size={16} />
          {t("booksEmpty.action")}
        </Button>
      </div>
    );
  }

  const orderedBooks = seriesBooksInReadingOrder(details.books);
  const duplicates = duplicatePartNumbers(details.books);

  return (
    <>
      <h2 className="sr-only">{t("booksHeading")}</h2>

      {duplicates.length === 0 ? null : (
        <p
          className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning"
          role="status"
        >
          <UiIcon aria-hidden className="mt-px shrink-0" name="alert-triangle" size={14} />
          {t("duplicateParts", { parts: duplicates.join(", ") })}
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {orderedBooks.map((book) => (
          <li key={book.id}>
            <SeriesBookCard
              book={book}
              isNextInOrder={details.nextBook?.id === book.id}
              seriesAuthors={details.authors}
            />
          </li>
        ))}
      </ol>

      <Button className="self-start" onClick={onAddBook} variant="outline">
        <UiIcon name="plus" size={16} />
        {t("addBookInline")}
      </Button>

      <SeriesReadingOrder books={details.books} />
    </>
  );
}
