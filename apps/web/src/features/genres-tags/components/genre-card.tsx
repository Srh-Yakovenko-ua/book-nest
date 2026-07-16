"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { GenreIcon, isGenreIconName, UiIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

import type { GenreCardItem } from "../model/genres-derive";

import { genreCoverPreview } from "../model/genres-derive";
import { genreLibraryHref } from "../model/library-links";

type GenreCardProps = {
  genre: GenreCardItem;
};

export function GenreCard({ genre }: GenreCardProps) {
  const t = useTranslations("genresTags.genres");
  const covers = genreCoverPreview(genre);

  return (
    <Card className="group relative flex flex-col gap-3.5 border border-border bg-card p-4 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-genre-soft text-genre">
          {isGenreIconName(genre.key) ? (
            <GenreIcon name={genre.key} size={20} />
          ) : (
            <UiIcon name="hash" size={18} />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="line-clamp-2 min-h-[2lh] font-heading text-base font-semibold text-ink">
            <Link
              className="outline-none after:absolute after:inset-0 after:content-[''] focus-visible:underline"
              href={genreLibraryHref(genre.key)}
            >
              {genre.label}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("booksCount", { count: genre.booksCount })}
          </p>
        </div>
        {genre.averageRating === null ? null : (
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-ink tabular-nums">
            <UiIcon className="text-favorite" name="star-fill" size={14} />
            {genre.averageRating.toFixed(1)}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("progress", { read: genre.readCount, total: genre.booksCount })}</span>
          {genre.readingQueueCount > 0 ? (
            <span>{t("inQueue", { count: genre.readingQueueCount })}</span>
          ) : null}
        </div>
        <div
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={genre.progressPercent}
          aria-valuetext={t("progress", { read: genre.readCount, total: genre.booksCount })}
          className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${genre.progressPercent}%` }}
          />
        </div>
      </div>

      {covers.length === 0 ? null : (
        <div className="flex items-center gap-1.5">
          {covers.map((url) => (
            <span
              className="relative aspect-[3/4] w-9 shrink-0 overflow-hidden rounded-sm border border-border bg-secondary"
              key={url}
            >
              <Image
                alt=""
                aria-hidden
                className="object-cover"
                fill
                sizes="36px"
                src={url}
                unoptimized
              />
            </span>
          ))}
          {genre.hiddenBooksCount > 0 ? (
            <span className="grid aspect-[3/4] w-9 shrink-0 place-items-center rounded-sm border border-border bg-secondary text-[11px] font-medium text-muted-foreground tabular-nums">
              +{genre.hiddenBooksCount}
            </span>
          ) : null}
        </div>
      )}
    </Card>
  );
}
