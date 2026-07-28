"use client";

import type { SeriesDetailsView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import { Fragment } from "react";

import { GenreIcon, isGenreIconName, UiIcon, type UiIconName } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, statusBadgeVariants } from "@/components/ui/status-badge";
import { useGenres } from "@/features/books";
import { seriesStatuses } from "@/lib/book-status";

import { seriesProgress } from "../model/series-derive";
import {
  resolveSeriesGenres,
  resolveSeriesReleaseYears,
  seriesCoverBooks,
} from "../model/series-details-derive";
import { SeriesCoverFan } from "./series-cover-fan";

const GENRE_LIMIT = 6;
const PUBLISHER_LIMIT = 3;
const DESCRIPTION_CLAMP_LENGTH = 180;
const DESCRIPTION_CLAMP_LINES = 3;

type SeriesDetailsHeroProps = {
  canAddBook: boolean;
  details: SeriesDetailsView;
  onAddBook: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onReadFullDescription: () => void;
};

export function SeriesDetailsHero({
  canAddBook,
  details,
  onAddBook,
  onDelete,
  onEdit,
  onReadFullDescription,
}: SeriesDetailsHeroProps) {
  const t = useTranslations("series.details");
  const tStatus = useTranslations("series.status");
  const tAge = useTranslations("books.classification.ageCategoryLabels");

  const statusBase =
    seriesStatuses.find((entry) => entry.value === details.status) ?? seriesStatuses[2];
  const authorsLine =
    details.authors.length > 0
      ? details.authors.map((author) => author.name).join(", ")
      : t("authorsUnknown");
  const description = details.description?.trim() ?? "";
  const hasAdultBook = details.books.some((book) => book.ageCategory === "18_plus");
  const coverBooks = seriesCoverBooks(details.books);
  const hasCoverFan = coverBooks.length > 0;
  const genres = useGenres();
  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));
  const genreKeys = resolveSeriesGenres({ books: details.books, seriesGenres: details.genres });
  const overflowGenreCount = genreKeys.length - GENRE_LIMIT;
  const releaseYears = resolveSeriesReleaseYears({ books: details.books, status: details.status });
  let yearsText: null | string = null;
  if (releaseYears !== null) {
    switch (releaseYears.kind) {
      case "range":
        yearsText = `${releaseYears.from}–${releaseYears.to}`;
        break;
      case "since":
        yearsText = t("sinceYear", { year: releaseYears.year });
        break;
      case "single":
        yearsText = String(releaseYears.year);
        break;
    }
  }
  const publisherNames = details.publishers.map((publisher) => publisher.name);
  const shownPublishers = publisherNames.slice(0, PUBLISHER_LIMIT);
  const overflowPublishers = publisherNames.length - shownPublishers.length;
  const publishersText =
    overflowPublishers > 0
      ? `${shownPublishers.join(", ")} ${t("publishersMore", { count: overflowPublishers })}`
      : shownPublishers.join(", ");
  const bookCount = details.totalBooks ?? details.booksInSeries;

  const metaItems: { icon: UiIconName; key: string; label: ReactNode }[] = [];
  if (bookCount > 0) {
    metaItems.push({ icon: "book", key: "books", label: t("books", { count: bookCount }) });
  }
  if (yearsText !== null) {
    metaItems.push({ icon: "calendar", key: "years", label: yearsText });
  }
  if (details.publishers.length > 0) {
    metaItems.push({ icon: "building", key: "publishers", label: publishersText });
  }

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-soft sm:flex-row sm:gap-7 md:p-7">
      {hasCoverFan ? (
        <SeriesCoverFan
          booksInSeries={details.booksInSeries}
          covers={coverBooks}
          name={details.name}
          totalBooks={details.totalBooks}
        />
      ) : null}

      <div className="hero-content-branch flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge entry={{ ...statusBase, label: tStatus(details.status) }} />
              {seriesProgress(details).fullyRead ? (
                <StatusBadge
                  entry={{
                    icon: "check-circle",
                    label: t("progress.completed"),
                    tone: "success",
                    value: "series-read",
                  }}
                />
              ) : null}
              {hasAdultBook ? (
                <span className={statusBadgeVariants({ tone: "danger" })}>{tAge("18_plus")}</span>
              ) : null}
            </div>
            <h1 className="font-heading text-2xl leading-tight font-semibold text-ink md:text-3xl">
              {details.name}
            </h1>
            <p className="text-base font-medium text-foreground/90">{authorsLine}</p>
            {genreKeys.length > 0 ? (
              <SeriesGenreList
                genreKeys={genreKeys.slice(0, GENRE_LIMIT)}
                genreNameByKey={genreNameByKey}
                moreLabel={
                  overflowGenreCount > 0 ? t("genresMore", { count: overflowGenreCount }) : null
                }
              />
            ) : null}
            {metaItems.length > 0 ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                {metaItems.map((item, index) => (
                  <Fragment key={item.key}>
                    {index > 0 ? <span aria-hidden>·</span> : null}
                    <span className="flex items-center gap-1.5">
                      <UiIcon aria-hidden className="text-icon" name={item.icon} size={15} />
                      {item.label}
                    </span>
                  </Fragment>
                ))}
              </div>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={t("menu")} className="shrink-0" size="icon" variant="outline">
                <UiIcon name="more" size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={onEdit}>
                <UiIcon name="edit" size={16} />
                {t("edit")}
              </DropdownMenuItem>
              {canAddBook ? (
                <DropdownMenuItem onSelect={onAddBook}>
                  <UiIcon name="plus" size={16} />
                  {t("addBook")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onDelete} variant="destructive">
                <UiIcon name="trash" size={16} />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {description.length === 0 ? null : (
          <div className="flex flex-col gap-1.5">
            <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
            {isDescriptionLong(description) ? (
              <button
                className="inline-flex cursor-pointer items-center gap-1 self-end text-sm font-medium text-primary transition-colors hover:text-primary/80"
                onClick={onReadFullDescription}
                type="button"
              >
                {t("readFullDescription")}
                <UiIcon aria-hidden name="arrow-right" size={14} />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function isDescriptionLong(text: string): boolean {
  return (
    text.length > DESCRIPTION_CLAMP_LENGTH || text.split("\n").length > DESCRIPTION_CLAMP_LINES
  );
}

function SeriesGenreList({
  genreKeys,
  genreNameByKey,
  moreLabel,
}: {
  genreKeys: string[];
  genreNameByKey: Map<string, string>;
  moreLabel: null | string;
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {genreKeys.map((key) => (
        <li
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-tag px-2.5 py-1 text-xs font-medium text-tag-foreground"
          key={key}
        >
          {isGenreIconName(key) ? (
            <GenreIcon className="shrink-0 text-brand/90" name={key} size={14} />
          ) : null}
          <span className="min-w-0 truncate">{genreNameByKey.get(key) ?? key}</span>
        </li>
      ))}
      {moreLabel === null ? null : (
        <li className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {moreLabel}
        </li>
      )}
    </ul>
  );
}
