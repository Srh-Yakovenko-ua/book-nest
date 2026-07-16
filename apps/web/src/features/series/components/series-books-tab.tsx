"use client";

import type { ReadingStatus, SeriesDetailsView } from "@app/shared";

import { Check, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { SeriesBookRouteState } from "../model/series-library-book";

import { duplicatePartNumbers, seriesBooksInReadingOrder } from "../model/series-details-derive";
import { seriesBookRouteState } from "../model/series-library-book";
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

      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-muted-foreground tabular-nums">
        <span className="text-success">
          {t("summary.finished", { count: details.stats.finishedCount })}
        </span>
        <span aria-hidden className="text-border">
          ·
        </span>
        <span>
          {t("summary.remaining", {
            count: details.stats.booksCount - details.stats.finishedCount,
          })}
        </span>
      </p>

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
        {orderedBooks.map((book, index) => (
          <li className="relative flex gap-3" key={book.id}>
            <SeriesTimelineMarker
              hasConnector={index < orderedBooks.length - 1}
              isNextInOrder={details.nextBook?.id === book.id}
              partNumber={book.partNumber}
              readingStatus={book.readingStatus}
            />

            <div className="min-w-0 flex-1">
              <SeriesBookCard
                book={book}
                isNextInOrder={details.nextBook?.id === book.id}
                seriesAuthors={details.authors}
              />
            </div>
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

const markerCircleClass =
  "flex size-8 shrink-0 items-center justify-center rounded-full border font-heading text-[0.8125rem] font-bold tabular-nums outline-1 outline-offset-2";

const markerToneClass: Record<SeriesBookRouteState, string> = {
  next: "border-primary bg-primary text-primary-foreground",
  read: "border-success bg-success text-background",
  unread: "border-border bg-secondary text-muted-foreground",
};

const outerToneClass: Record<SeriesBookRouteState, string> = {
  next: "outline-primary/30",
  read: "outline-success/30",
  unread: "outline-border",
};

function SeriesTimelineMarker({
  hasConnector,
  isNextInOrder,
  partNumber,
  readingStatus,
}: {
  hasConnector: boolean;
  isNextInOrder: boolean;
  partNumber: null | number;
  readingStatus: ReadingStatus;
}) {
  const t = useTranslations("series.details.row");
  const state = seriesBookRouteState({ isNextInOrder, readingStatus });

  return (
    <div className="relative flex w-8 shrink-0 justify-center pt-3">
      {partNumber === null ? null : (
        <span className="sr-only">{t("part", { number: partNumber })}</span>
      )}

      {hasConnector ? (
        <span
          aria-hidden
          className={cn(
            "absolute inset-x-0 top-13 -bottom-4 mx-auto w-px",
            state === "read" ? "bg-success/40" : "bg-border",
          )}
        />
      ) : null}

      <span
        aria-hidden
        className={cn(
          markerCircleClass,
          markerToneClass[state],
          outerToneClass[state],
          state !== "read" && "pb-[3px]",
        )}
      >
        {state === "read" ? <Check aria-hidden size={14} strokeWidth={3} /> : (partNumber ?? "—")}
      </span>

      {state === "next" ? (
        <ChevronRight
          aria-hidden
          className="absolute top-7 left-8 translate-x-px -translate-y-1/2 text-primary"
          size={12}
          strokeWidth={3}
        />
      ) : null}
    </div>
  );
}
