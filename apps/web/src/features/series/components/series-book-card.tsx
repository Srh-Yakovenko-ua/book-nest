"use client";

import type { SeriesBookView, SeriesDetailsView } from "@app/shared";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { LibraryBook } from "@/features/books/model/library-book";

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
import { StatusBadge } from "@/components/ui/status-badge";
import { useUpdateBook } from "@/features/books/api/use-update-book";
import { BookRow } from "@/features/books/components/book-row";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { SeriesBookProgress } from "../model/series-library-book";

import {
  isReadingNow,
  seriesBookProgress,
  seriesBookRouteState,
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
  const routeState = seriesBookRouteState({ isNextInOrder, readingStatus: book.readingStatus });
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
        accent={routeState === "unread" && isReadingNow(book.readingStatus)}
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
        linkComponent={Link}
        note={
          <SeriesBookNote
            href={libraryBook.href}
            isNextInOrder={isNextInOrder}
            ownership={libraryBook.ownership}
            partNumber={book.partNumber}
            progress={progress}
            status={libraryBook.status}
          />
        }
        statusPlacement="note"
        tone={routeState === "unread" ? undefined : routeState}
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

function SeriesBookNote({
  href,
  isNextInOrder,
  ownership,
  partNumber,
  progress,
  status,
}: {
  href: string;
  isNextInOrder: boolean;
  ownership?: LibraryBook["ownership"];
  partNumber: null | number;
  progress?: SeriesBookProgress;
  status: LibraryBook["status"];
}) {
  const t = useTranslations("series.details.row");
  const tNext = useTranslations("series.details.next");

  return (
    <div className="flex flex-col items-start gap-1.5 pt-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {isNextInOrder ? (
          <Badge className="h-6 border-primary/40" variant="primary">
            <UiIcon name="bookmark" size={12} />
            {t("nextInOrder")}
          </Badge>
        ) : null}

        <StatusBadge entry={status} />

        {ownership === undefined ? null : (
          <StatusBadge
            className="border border-border bg-transparent font-medium text-muted-foreground"
            entry={ownership}
            tone="neutral"
          />
        )}
      </div>

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

      {partNumber === null ? (
        <span className="text-xs text-muted-foreground">{t("partUnknown")}</span>
      ) : null}

      {isNextInOrder ? (
        <Button asChild className="relative z-10 mt-0.5" size="sm">
          <Link href={href}>
            {tNext("cta")}
            <ArrowRight aria-hidden size={16} />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
