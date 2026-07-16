"use client";

import type { SeriesBookView, SeriesDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useUpdateBook } from "@/features/books/api/use-update-book";
import { BookRow } from "@/features/books/components/book-row";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { SeriesBookProgress } from "../model/series-library-book";

import {
  isReadingNow,
  seriesBookProgress,
  toSeriesLibraryBook,
} from "../model/series-library-book";
import { RemoveBookFromSeriesDialog } from "./remove-book-from-series-dialog";

type SeriesBookCardProps = {
  book: SeriesBookView;
  isNextInOrder: boolean;
  seriesAuthors: SeriesDetailsView["authors"];
};

export function SeriesBookCard({ book, isNextInOrder, seriesAuthors }: SeriesBookCardProps) {
  const t = useTranslations("series.details.row");
  const tLibrary = useTranslations("books.library");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tReading = useTranslations("books.readingStatus.options");
  const tToast = useTranslations("series.toast");

  const [removeOpen, setRemoveOpen] = useState(false);
  const removeFromSeries = useUpdateBook(book.id);
  const toggleFavorite = useUpdateBook(book.id);

  const libraryBook = toSeriesLibraryBook({
    book,
    labels: {
      authorsUnknown: t("authorsUnknown"),
      ownershipLabel: (value) => tOwnership(value),
      ratingLabel: (value) => tLibrary("rating.ariaLabel", { value }),
      statusLabel: (value) => tReading(value),
    },
    seriesAuthors,
  });
  const progress = seriesBookProgress(book);
  const favoriteLabel = book.isFavorite
    ? tLibrary("actions.unfavorite")
    : tLibrary("actions.favorite");

  function onConfirmRemove() {
    removeFromSeries.mutate(
      { bookType: "solo" },
      {
        onError: () => toast.error(tToast("error")),
        onSuccess: () => {
          toast.success(tToast("bookRemoved"));
          setRemoveOpen(false);
        },
      },
    );
  }

  return (
    <>
      <BookRow
        accent={isReadingNow(book.readingStatus)}
        book={libraryBook}
        kebab={
          <div className="flex items-center gap-0.5">
            <Button
              aria-label={favoriteLabel}
              aria-pressed={book.isFavorite}
              className={cn(
                "size-8 rounded-lg border transition-all duration-[180ms] ease-out",
                book.isFavorite
                  ? "border-brand bg-brand text-white shadow-btn hover:border-primary-hover hover:bg-primary-hover hover:text-white dark:hover:bg-primary-hover"
                  : "border-border bg-card text-muted-foreground hover:border-brand hover:text-brand",
              )}
              disabled={toggleFavorite.isPending}
              onClick={() =>
                toggleFavorite.mutate(
                  { isFavorite: !book.isFavorite },
                  { onError: () => toast.error(tToast("error")) },
                )
              }
              size="icon-sm"
              title={favoriteLabel}
              variant="ghost"
            >
              <UiIcon name={book.isFavorite ? "heart-fill" : "heart"} size={18} />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label={t("menu")}
                  className="size-8 rounded-lg border border-border bg-card text-muted-foreground transition-all duration-[180ms] ease-out hover:border-brand hover:text-brand"
                  size="icon-sm"
                  variant="ghost"
                >
                  <UiIcon name="more" size={18} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <Link href={libraryBook.href}>
                    <UiIcon name="book" size={16} />
                    {t("view")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setRemoveOpen(true)} variant="destructive">
                  <UiIcon name="x-circle" size={16} />
                  {t("remove")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
        leading={<PartNumberBadge partNumber={book.partNumber} />}
        linkComponent={Link}
        note={
          <SeriesBookNote
            isNextInOrder={isNextInOrder}
            partNumber={book.partNumber}
            progress={progress}
          />
        }
      />

      <RemoveBookFromSeriesDialog
        isRemoving={removeFromSeries.isPending}
        onConfirm={onConfirmRemove}
        onOpenChange={(open) => {
          if (!open && !removeFromSeries.isPending) setRemoveOpen(false);
        }}
        open={removeOpen}
      />
    </>
  );
}

const partNumberBadgeClass =
  "grid size-9 place-items-center rounded-md bg-accent font-heading text-sm font-bold text-accent-foreground tabular-nums";

function PartNumberBadge({ partNumber }: { partNumber: null | number }) {
  const t = useTranslations("series.details.row");

  if (partNumber === null) {
    return (
      <span aria-hidden className={partNumberBadgeClass}>
        —
      </span>
    );
  }

  return (
    <span className={partNumberBadgeClass}>
      <span className="sr-only">{t("part", { number: partNumber })}</span>
      <span aria-hidden>{partNumber}</span>
    </span>
  );
}

function SeriesBookNote({
  isNextInOrder,
  partNumber,
  progress,
}: {
  isNextInOrder: boolean;
  partNumber: null | number;
  progress?: SeriesBookProgress;
}) {
  const t = useTranslations("series.details.row");

  if (progress === undefined && !isNextInOrder && partNumber !== null) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {progress === undefined ? null : (
        <span className="flex items-center gap-2">
          <Progress
            aria-label={t("progress", { current: progress.current, total: progress.total })}
            className="h-1 w-20"
            value={progress.percent}
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("progress", { current: progress.current, total: progress.total })} ·{" "}
            {t("progressPercent", { percent: progress.percent })}
          </span>
        </span>
      )}

      {isNextInOrder ? (
        <Badge variant="primary">
          <UiIcon name="bookmark" size={12} />
          {t("nextInOrder")}
        </Badge>
      ) : null}

      {partNumber === null ? (
        <span className="text-xs text-muted-foreground">{t("partUnknown")}</span>
      ) : null}
    </div>
  );
}
