"use client";

import type { BookFormat, BookView, ReadingStatus } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { RatingScore } from "@/components/ui/rating-score";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/navigation";
import {
  bookFormats,
  ownershipStatuses,
  readingStatuses,
  type StatusEntry,
} from "@/lib/book-status";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

import { useToggleFavorite } from "../api/use-book-actions";
import { resolveReadingProgress } from "../model/reading-progress";
import { BookDetailsActionsMenu } from "./book-details-actions-menu";
import { UpdateReadingProgressDialog } from "./update-reading-progress-dialog";

type BookDetailsHeroProps = {
  book: BookView;
};

const PROGRESS_STATUSES: readonly ReadingStatus[] = ["reading", "paused", "rereading"];

type BadgeLabels = {
  format: (value: BookFormat) => string;
  ownership: (value: BookView["ownershipStatus"]) => string;
  reading: (value: ReadingStatus) => string;
  seriesPart: (name: string, number: null | number) => string;
};

export function BookDetailsHero({ book }: BookDetailsHeroProps) {
  const t = useTranslations("books");
  const locale = useLocale();
  const favorite = useToggleFavorite();
  const [updateOpen, setUpdateOpen] = useState(false);

  const isFavorite =
    favorite.isPending && favorite.variables !== undefined
      ? favorite.variables.isFavorite
      : book.isFavorite;

  const authorNames = book.authors.map((author) => author.name).join(", ");
  const rating = book.readingProgress?.rating ?? null;
  const progress = PROGRESS_STATUSES.includes(book.readingStatus)
    ? resolveReadingProgress(book)
    : null;

  const publisherName = book.publisher?.name ?? null;
  const publicationYear = book.publicationYear;

  function toggleFavorite() {
    favorite.mutate(
      { id: book.id, isFavorite: !isFavorite },
      {
        onError: () => toast.error(t("library.toast.error")),
        onSuccess: () =>
          toast.success(
            isFavorite ? t("library.toast.favoriteRemoved") : t("library.toast.favoriteAdded"),
          ),
      },
    );
  }

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-soft sm:flex-row sm:gap-7 md:p-7">
      <BookDetailsCover
        alt={t("details.coverAlt", { title: book.title })}
        src={book.cover?.urls.card}
        title={book.title}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="font-heading text-2xl leading-tight font-semibold text-ink md:text-3xl">
              {book.title}
            </h1>
            {book.originalTitle === null ? null : (
              <p className="text-sm text-muted-foreground italic">{book.originalTitle}</p>
            )}
            {authorNames.length > 0 ? (
              <p className="text-base font-medium text-foreground/90">{authorNames}</p>
            ) : null}
            {publisherName === null && publicationYear === null ? null : (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {publisherName === null ? null : (
                  <span className="inline-flex items-center gap-1.5">
                    <UiIcon className="shrink-0" name="building" size={15} />
                    {publisherName}
                  </span>
                )}
                {publicationYear === null ? null : (
                  <span className="inline-flex items-center gap-1.5">
                    <UiIcon className="shrink-0" name="calendar" size={15} />
                    {publicationYear}
                  </span>
                )}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              aria-label={isFavorite ? t("details.favorite.remove") : t("details.favorite.add")}
              aria-pressed={isFavorite}
              disabled={favorite.isPending}
              onClick={toggleFavorite}
              size="icon"
              variant="outline"
            >
              <UiIcon
                className={isFavorite ? "text-primary" : undefined}
                name={isFavorite ? "heart-fill" : "heart"}
                size={18}
              />
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/books/${book.id}/edit`}>
                <UiIcon name="edit" size={16} />
                {t("details.edit")}
              </Link>
            </Button>
            <BookDetailsActionsMenu book={book} />
          </div>
        </div>

        <BadgeRow book={book} />

        {rating === null && progress === null ? null : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {rating === null ? null : <RatingScore value={rating} />}
            {progress === null ? null : (
              <button
                aria-label={t("details.reading.updateCta")}
                className="group inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-sm text-muted-foreground tabular-nums transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                onClick={() => setUpdateOpen(true)}
                type="button"
              >
                {t("details.progress", {
                  current: progress.current,
                  percent: progress.percent,
                  total: progress.total,
                })}
                <UiIcon
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  name="edit"
                  size={13}
                />
              </button>
            )}
          </div>
        )}

        <p className="mt-auto text-xs text-muted-foreground">
          {t("details.addedOn", { date: formatDate(book.createdAt, locale) })}
        </p>
      </div>

      <UpdateReadingProgressDialog book={book} onOpenChange={setUpdateOpen} open={updateOpen} />
    </section>
  );
}

function BadgeRow({ book }: { book: BookView }) {
  const t = useTranslations("books");
  const badges = buildBadges(book, {
    format: (value) => t(`format.options.${value}`),
    ownership: (value) => t(`ownershipStatus.options.${value}`),
    reading: (value) => t(`readingStatus.options.${value}`),
    seriesPart: (name, number) =>
      number === null ? name : t("details.seriesPartWithNumber", { number, series: name }),
  });

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((entry) => (
        <StatusBadge entry={entry} key={`${entry.value}-${entry.label}`} />
      ))}
    </div>
  );
}

function BookDetailsCover({ alt, src, title }: { alt: string; src?: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const initial = title.trim().charAt(0).toUpperCase();

  return (
    <div className="relative mx-auto aspect-[3/4] w-40 shrink-0 overflow-hidden rounded-xl bg-accent shadow-card sm:mx-0 sm:w-44">
      {src === undefined || failed ? (
        <div className="grid h-full w-full place-items-center text-accent-foreground">
          {initial.length === 0 ? (
            <UiIcon name="book" size={40} />
          ) : (
            <span className="font-heading text-5xl leading-none font-semibold">{initial}</span>
          )}
        </div>
      ) : (
        <Image
          alt={alt}
          className={cn(
            "object-cover transition-opacity duration-500 ease-out",
            loaded ? "opacity-100" : "motion-safe:opacity-0",
          )}
          fill
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          sizes="176px"
          src={src}
          unoptimized
        />
      )}
    </div>
  );
}

function buildBadges(book: BookView, labels: BadgeLabels): StatusEntry[] {
  const badges: StatusEntry[] = [];

  const readingBase = readingStatuses.find((entry) => entry.value === book.readingStatus);
  if (readingBase !== undefined) {
    badges.push({ ...readingBase, label: labels.reading(book.readingStatus) });
  }

  if (book.ownershipStatus !== "none") {
    const ownershipBase = ownershipStatuses.find((entry) => entry.value === book.ownershipStatus);
    if (ownershipBase !== undefined) {
      badges.push({ ...ownershipBase, label: labels.ownership(book.ownershipStatus) });
    }
  }

  for (const value of book.formats) {
    const formatBase = bookFormats.find((entry) => entry.value === value);
    if (formatBase !== undefined) badges.push({ ...formatBase, label: labels.format(value) });
  }

  if (book.bookType === "series_part" && book.series !== null) {
    badges.push({
      icon: "layers",
      label: labels.seriesPart(book.series.name, book.partNumber),
      tone: "accent",
      value: "series_part",
    });
  }

  return badges;
}
