"use client";

import type { SeriesBookView, SeriesDetailsView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { LibraryBook } from "@/features/books/model/library-book";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/status-badge";
import { useUpdateBook } from "@/features/books/api/use-update-book";
import { BookRow } from "@/features/books/components/book-row";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type {
  SeriesBookPrimaryAction,
  SeriesEditionLine,
  SeriesLibraryBookLabels,
  SeriesPersonalState,
  SeriesStartTarget,
} from "../model/series-library-book";

import {
  isReadingNow,
  seriesBookEdition,
  seriesBookPersonalState,
  seriesBookPrimaryAction,
  seriesBookRouteState,
  toSeriesLibraryBook,
} from "../model/series-library-book";
import { RemoveBookFromSeriesDialog } from "./remove-book-from-series-dialog";

type SeriesBookCardProps = {
  activeProgressBookId: null | string;
  book: SeriesBookView;
  isNextInOrder: boolean;
  onStartReading: (target: SeriesStartTarget) => void;
  onUpdateProgress: (bookId: string) => void;
  seriesAuthors: SeriesDetailsView["authors"];
};

export function SeriesBookCard({
  activeProgressBookId,
  book,
  isNextInOrder,
  onStartReading,
  onUpdateProgress,
  seriesAuthors,
}: SeriesBookCardProps) {
  const t = useTranslations("series.details.row");
  const tLibrary = useTranslations("books.library");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const tReading = useTranslations("books.readingStatus.options");
  const tFormat = useTranslations("books.format.options");
  const tAge = useTranslations("books.classification.ageCategoryLabels");
  const tToast = useTranslations("series.toast");

  const [removeOpen, setRemoveOpen] = useState(false);
  const removeFromSeries = useUpdateBook(book.id);
  const toggleFavorite = useUpdateBook(book.id);

  const labels: SeriesLibraryBookLabels = {
    ageBadge18Plus: tAge("18_plus"),
    authorsUnknown: t("authorsUnknown"),
    formatLabel: (value) => tFormat(value),
    ownershipLabel: (value) => tOwnership(value),
    pagesText: (value) => tLibrary("meta.pages", { value }),
    ratingLabel: (value) => tLibrary("rating.ariaLabel", { value }),
    statusLabel: (value) => tReading(value),
  };

  const libraryBook = toSeriesLibraryBook({ book, labels, seriesAuthors });
  const edition = seriesBookEdition({ book, labels });
  const personalState = seriesBookPersonalState(book);
  const routeState = seriesBookRouteState({ isNextInOrder, readingStatus: book.readingStatus });
  const primaryAction = seriesBookPrimaryAction({
    isNextInOrder,
    ownershipStatus: book.ownershipStatus,
    readingStatus: book.readingStatus,
  });
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
        actionsSlot={
          primaryAction === undefined ? undefined : (
            <div className="relative z-10">
              <SeriesBookPrimaryActionButton
                action={primaryAction}
                historyHref={`/books/${book.id}?tab=history`}
                isProgressPending={activeProgressBookId === book.id}
                onStartReading={() => onStartReading({ id: book.id, title: book.title })}
                onUpdateProgress={() => onUpdateProgress(book.id)}
              />
            </div>
          )
        }
        book={libraryBook}
        coverAspect="portrait"
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
                <DropdownMenuItem onSelect={() => setRemoveOpen(true)} variant="destructive">
                  <UiIcon name="x-circle" size={16} />
                  {t("remove")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
        linkComponent={Link}
        note={edition.length === 0 ? undefined : <SeriesBookEdition lines={edition} />}
        statusPlacement="column"
        statusSlot={
          <SeriesStatusZone
            isInReadingQueue={book.isInReadingQueue}
            ownership={libraryBook.ownership}
            personalState={personalState}
            status={libraryBook.status}
          />
        }
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

function assertNever(value: never): never {
  throw new Error(`Unexpected series personal state: ${JSON.stringify(value)}`);
}

function SeriesBookEdition({ lines }: { lines: SeriesEditionLine[] }) {
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line) => (
        <span
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
          key={`${line.icon}-${line.label}`}
        >
          <UiIcon className="shrink-0 text-icon" name={line.icon} size={15} />
          {line.label}
        </span>
      ))}
    </div>
  );
}

function SeriesBookPrimaryActionButton({
  action,
  historyHref,
  isProgressPending,
  onStartReading,
  onUpdateProgress,
}: {
  action: SeriesBookPrimaryAction;
  historyHref: string;
  isProgressPending: boolean;
  onStartReading: () => void;
  onUpdateProgress: () => void;
}) {
  const t = useTranslations("series.details.row");
  const tReading = useTranslations("books.details.reading");

  if (action === "history") {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href={historyHref}>
          <UiIcon name="clock" size={14} />
          {t("history")}
        </Link>
      </Button>
    );
  }

  if (action === "start") {
    return (
      <Button onClick={onStartReading} size="sm">
        <UiIcon name="book" size={14} />
        {tReading("startCta")}
      </Button>
    );
  }

  return (
    <Button loading={isProgressPending} onClick={onUpdateProgress} size="sm">
      <UiIcon name="edit" size={14} />
      {tReading("updateCta")}
    </Button>
  );
}

function SeriesPersonalStateRow({ state }: { state: SeriesPersonalState }) {
  const t = useTranslations("series.details.row");

  switch (state.kind) {
    case "dnf":
      return <span className="text-xs text-muted-foreground">{t("dnf")}</span>;
    case "paused":
      return (
        <span className="text-xs text-muted-foreground tabular-nums">
          {state.pages === null
            ? t("pausedShort")
            : t("paused", { current: state.pages.current, total: state.pages.total })}
        </span>
      );
    case "progress":
      return (
        <div className="flex flex-col gap-1">
          <Progress
            aria-label={t("progress", { current: state.pages.current, total: state.pages.total })}
            aria-valuenow={state.percent}
            className="h-1 w-full max-w-28"
            value={state.percent}
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {t("progressLine", {
              current: state.pages.current,
              percent: state.percent,
              total: state.pages.total,
            })}
          </span>
        </div>
      );
    default:
      return assertNever(state);
  }
}

function SeriesStatusZone({
  isInReadingQueue,
  ownership,
  personalState,
  status,
}: {
  isInReadingQueue: boolean;
  ownership?: LibraryBook["ownership"];
  personalState?: SeriesPersonalState;
  status: LibraryBook["status"];
}) {
  const tQueue = useTranslations("books.details.queue");

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2 @xl/book-row:w-40",
        personalState === undefined && "justify-center",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge entry={status} />

        {ownership === undefined ? null : <StatusBadge entry={ownership} />}

        {isInReadingQueue ? (
          <StatusBadge
            entry={{ icon: "list", label: tQueue("inQueue"), tone: "info", value: "in_queue" }}
          />
        ) : null}
      </div>

      {personalState === undefined ? null : <SeriesPersonalStateRow state={personalState} />}
    </div>
  );
}
