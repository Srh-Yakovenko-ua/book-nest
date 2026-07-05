"use client";

import type { ReadingStatus, SeriesBookView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { RatingScore } from "@/components/ui/rating-score";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUpdateBook } from "@/features/books/api/use-update-book";
import { Link } from "@/i18n/navigation";
import { ownershipStatuses, readingStatuses } from "@/lib/book-status";

import { RemoveBookFromSeriesDialog } from "./remove-book-from-series-dialog";

type SeriesBookRowProps = {
  book: SeriesBookView;
};

const PROGRESS_STATUSES: ReadonlySet<ReadingStatus> = new Set<ReadingStatus>([
  "reading",
  "rereading",
]);

export function SeriesBookRow({ book }: SeriesBookRowProps) {
  const t = useTranslations("series.details.row");
  const tReading = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tToast = useTranslations("series.toast");
  const [removeOpen, setRemoveOpen] = useState(false);
  const removeFromSeries = useUpdateBook(book.id);

  const readingBase = readingStatuses.find((entry) => entry.value === book.readingStatus);
  const ownershipBase = ownershipStatuses.find((entry) => entry.value === book.ownershipStatus);
  const authorsLine =
    book.authors.length > 0
      ? book.authors.map((author) => author.name).join(", ")
      : t("authorsUnknown");

  const showProgress =
    PROGRESS_STATUSES.has(book.readingStatus) &&
    book.currentPage !== null &&
    book.pagesCount !== null &&
    book.pagesCount > 0;
  const percent =
    showProgress && book.currentPage !== null && book.pagesCount !== null
      ? Math.round((book.currentPage / book.pagesCount) * 100)
      : 0;

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
    <article className="group/series-row @container/series-row relative flex items-center gap-3.5 rounded-xl border border-border bg-card p-3 shadow-card transition-[box-shadow,border-color] duration-200 ease-out focus-within:border-accent-border focus-within:shadow-hover hover:border-accent-border hover:shadow-hover motion-reduce:transition-none">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent font-heading text-sm font-bold text-accent-foreground tabular-nums">
        {book.partNumber ?? "—"}
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="truncate font-heading text-sm leading-tight font-bold text-ink">
          <Link
            className="text-ink no-underline transition-colors group-hover/series-row:text-primary after:absolute after:inset-0 focus-visible:text-primary"
            href={`/books/${book.id}`}
          >
            {book.title}
          </Link>
        </h3>
        <p className="truncate text-xs text-muted-foreground">{authorsLine}</p>
        {showProgress ? (
          <div className="mt-0.5 flex items-center gap-2">
            <Progress
              aria-label={t("progress", {
                current: book.currentPage ?? 0,
                total: book.pagesCount ?? 0,
              })}
              className="h-1 w-20"
              value={percent}
            />
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("progress", { current: book.currentPage ?? 0, total: book.pagesCount ?? 0 })}
            </span>
          </div>
        ) : null}
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-1 @sm/series-row:flex">
        {readingBase === undefined ? null : (
          <StatusBadge entry={{ ...readingBase, label: tReading(book.readingStatus) }} />
        )}
        {ownershipBase === undefined || book.ownershipStatus === "none" ? null : (
          <StatusBadge entry={{ ...ownershipBase, label: tOwnership(book.ownershipStatus) }} />
        )}
      </div>

      {book.rating !== null ? (
        <div className="hidden shrink-0 items-center @lg/series-row:flex">
          <RatingScore value={book.rating} />
        </div>
      ) : null}

      <div className="relative z-10 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label={t("menu")} size="icon" variant="ghost">
              <UiIcon name="more" size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link href={`/books/${book.id}`}>
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

      <RemoveBookFromSeriesDialog
        isRemoving={removeFromSeries.isPending}
        onConfirm={onConfirmRemove}
        onOpenChange={(open) => {
          if (!open && !removeFromSeries.isPending) setRemoveOpen(false);
        }}
        open={removeOpen}
      />
    </article>
  );
}
