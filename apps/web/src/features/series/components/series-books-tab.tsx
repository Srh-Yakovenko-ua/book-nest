"use client";

import type { SeriesDetailsView } from "@app/shared";

import { Check, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { SeriesSlot } from "../model/series-details-derive";
import type { SeriesBookRouteState } from "../model/series-library-book";

import { buildSeriesSlots, duplicatePartNumbers } from "../model/series-details-derive";
import { seriesBookRouteState } from "../model/series-library-book";
import { SeriesBookCard } from "./series-book-card";

type SeriesBooksTabProps = {
  details: SeriesDetailsView;
  onAddBook: (partNumber: null | number) => void;
};

type SeriesTimelineSlot = Exclude<SeriesSlot, { kind: "open" }>;

type SeriesTimelineState = "missing" | SeriesBookRouteState;

export function SeriesBooksTab({ details, onAddBook }: SeriesBooksTabProps) {
  const t = useTranslations("series.details");

  if (details.books.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-accent text-icon">
          <UiIcon name="book" size={24} />
        </span>
        <p className="text-sm font-medium text-ink">{t("booksEmpty.title")}</p>
        <Button onClick={() => onAddBook(null)}>
          <UiIcon name="plus" size={16} />
          {t("booksEmpty.action")}
        </Button>
      </div>
    );
  }

  const slots = buildSeriesSlots({
    books: details.books,
    totalBooks: details.totalBooks,
  }).filter((slot): slot is SeriesTimelineSlot => slot.kind !== "open");
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
        {slots.map((slot, index) => (
          <li className="relative flex gap-3" key={slot.key}>
            <SeriesTimelineMarker
              hasConnector={index < slots.length - 1}
              partNumber={slotPartNumber(slot)}
              state={slotTimelineState(slot, details.nextBook?.id)}
            />

            <div className="min-w-0 flex-1">
              {slot.kind === "missing" ? (
                <SeriesMissingBookRow number={slot.number} onAddBook={onAddBook} />
              ) : (
                <SeriesBookCard
                  book={slot.book}
                  isNextInOrder={details.nextBook?.id === slot.book.id}
                  seriesAuthors={details.authors}
                />
              )}
            </div>
          </li>
        ))}
      </ol>

      <Button className="self-start" onClick={() => onAddBook(null)} variant="outline">
        <UiIcon name="plus" size={16} />
        {t("addBookInline")}
      </Button>
    </>
  );
}

const markerCircleClass =
  "flex size-8 shrink-0 items-center justify-center rounded-full border font-heading text-[0.8125rem] font-bold tabular-nums outline-1 outline-offset-2";

const markerToneClass: Record<SeriesTimelineState, string> = {
  missing: "border-dashed border-border bg-transparent text-muted-foreground",
  next: "border-primary bg-primary text-primary-foreground",
  read: "border-success bg-success text-background",
  unread: "border-border bg-secondary text-muted-foreground",
};

const outerToneClass: Record<SeriesTimelineState, string> = {
  missing: "outline-transparent",
  next: "outline-primary/30",
  read: "outline-success/30",
  unread: "outline-border",
};

function SeriesMissingBookRow({
  number,
  onAddBook,
}: {
  number: number;
  onAddBook: (partNumber: number) => void;
}) {
  const t = useTranslations("series.details.missingRow");

  return (
    <div className="flex min-h-[9.5rem] items-start gap-3.5 rounded-xl border border-dashed border-border bg-card/40 p-3">
      <div className="grid aspect-[2/3] w-24 shrink-0 place-items-center rounded-lg border border-dashed border-accent-border bg-field text-muted-foreground">
        <UiIcon aria-hidden name="book" size={32} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-heading text-sm leading-tight font-bold text-muted-foreground">
          {t("title", { number })}
        </p>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>

      <Button
        aria-label={t("actionAria", { number })}
        className="shrink-0 self-center"
        onClick={() => onAddBook(number)}
        size="sm"
        variant="secondary"
      >
        <UiIcon name="plus" size={16} />
        {t("action")}
      </Button>
    </div>
  );
}

function SeriesTimelineMarker({
  hasConnector,
  partNumber,
  state,
}: {
  hasConnector: boolean;
  partNumber: null | number;
  state: SeriesTimelineState;
}) {
  const t = useTranslations("series.details.row");

  return (
    <div className="relative flex w-8 shrink-0 justify-center pt-3">
      {partNumber === null ? null : (
        <span className="sr-only">{t("part", { number: partNumber })}</span>
      )}

      {state === "next" ? <span className="sr-only">{t("nextInOrder")}</span> : null}

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

function slotPartNumber(slot: SeriesTimelineSlot): null | number {
  return slot.kind === "missing" ? slot.number : slot.book.partNumber;
}

function slotTimelineState(slot: SeriesTimelineSlot, nextBookId?: string): SeriesTimelineState {
  if (slot.kind === "missing") return "missing";
  return seriesBookRouteState({
    isNextInOrder: slot.book.id === nextBookId,
    readingStatus: slot.book.readingStatus,
  });
}
