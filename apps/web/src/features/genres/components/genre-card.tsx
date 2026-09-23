"use client";

import type { GenreStatsView, Nullable } from "@app/shared";
import type { PointerEvent, RefObject } from "react";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { genreCoverPreview, genreReadProgressPercent } from "../model/genre-card";
import { genreLibraryHref } from "../model/genre-links";
import { GenreBadge } from "./genre-badge";

type GenreCardProps = {
  genre: GenreStatsView;
};

type RatingHintSource = { focused: boolean; hovered: boolean };

const GENRE_CARD_STYLES = {
  coverTile: "relative aspect-[3/4] w-9 shrink-0 overflow-hidden rounded-sm border border-border",
  ratingFormat: { maximumFractionDigits: 1, minimumFractionDigits: 1 },
} as const;

export function GenreCard({ genre }: GenreCardProps) {
  const t = useTranslations("genres.card");
  const locale = useLocale();
  const ratingContextId = useId();
  const progressId = useId();
  const ratingRef = useRef<HTMLSpanElement>(null);
  const [ratingHint, setRatingHint] = useState<RatingHintSource>({
    focused: false,
    hovered: false,
  });
  const progress = t("progress", { read: genre.readCount, total: genre.booksCount });
  const averageRating =
    genre.ratedBooksCount === 0 || genre.averageRating === null
      ? null
      : formatNumber(genre.averageRating, locale, GENRE_CARD_STYLES.ratingFormat);

  function trackRatingHover(event: PointerEvent<HTMLAnchorElement>) {
    const hovered = isPointerOver(ratingRef.current, event);
    setRatingHint((prev) => (prev.hovered === hovered ? prev : { ...prev, hovered }));
  }

  return (
    <Card className="group relative flex h-full flex-col gap-3.5 border border-border bg-card p-4 shadow-card transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-hover active:translate-y-0 active:shadow-card has-[a:focus-visible]:border-ring has-[a:focus-visible]:ring-3 has-[a:focus-visible]:ring-ring/50 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-start gap-3">
        <GenreBadge genreKey={genre.key} size="card" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="line-clamp-2 min-h-[2lh] font-heading text-base font-semibold break-words text-ink">
            <Link
              aria-describedby={averageRating === null ? undefined : ratingContextId}
              className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
              href={genreLibraryHref(genre.key)}
              onBlur={() => setRatingHint((prev) => ({ ...prev, focused: false }))}
              onFocus={(event) =>
                setRatingHint((prev) => ({
                  ...prev,
                  focused: event.currentTarget.matches(":focus-visible"),
                }))
              }
              onPointerLeave={() => setRatingHint((prev) => ({ ...prev, hovered: false }))}
              onPointerMove={averageRating === null ? undefined : trackRatingHover}
            >
              {genre.label}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("booksCount", { count: genre.booksCount })}
          </p>
        </div>
        {averageRating === null ? null : (
          <GenreRating
            averageRating={averageRating}
            contextId={ratingContextId}
            onDismiss={() => setRatingHint({ focused: false, hovered: false })}
            open={ratingHint.focused || ratingHint.hovered}
            ratedBooksCount={genre.ratedBooksCount}
            triggerRef={ratingRef}
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span id={progressId}>{progress}</span>
          {genre.readingQueueCount > 0 ? (
            <span className="shrink-0">{t("inQueue", { count: genre.readingQueueCount })}</span>
          ) : null}
        </div>
        <div
          aria-labelledby={progressId}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={genreReadProgressPercent(genre)}
          aria-valuetext={progress}
          className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${genreReadProgressPercent(genre)}%` }}
          />
        </div>
      </div>

      <GenreCoverStrip genre={genre} />
    </Card>
  );
}

function GenreCoverStrip({ genre }: { genre: GenreStatsView }) {
  const preview = genreCoverPreview(genre);

  return (
    <div aria-hidden className="mt-auto flex items-center gap-1.5">
      {preview.kind === "covers" ? (
        preview.covers.map((url) => (
          <span className={cn(GENRE_CARD_STYLES.coverTile, "bg-secondary")} key={url}>
            <Image alt="" className="object-cover" fill sizes="36px" src={url} unoptimized />
          </span>
        ))
      ) : (
        <span
          className={cn(
            GENRE_CARD_STYLES.coverTile,
            "grid place-items-center bg-secondary text-muted-foreground",
          )}
          data-slot="genre-cover-placeholder"
        >
          <UiIcon name="book" size={16} />
        </span>
      )}
      {preview.hiddenBooksCount > 0 ? (
        <span
          className={cn(
            GENRE_CARD_STYLES.coverTile,
            "grid place-items-center bg-secondary text-[11px] font-medium text-muted-foreground tabular-nums",
          )}
        >
          +{preview.hiddenBooksCount}
        </span>
      ) : null}
    </div>
  );
}

function GenreRating({
  averageRating,
  contextId,
  onDismiss,
  open,
  ratedBooksCount,
  triggerRef,
}: {
  averageRating: string;
  contextId: string;
  onDismiss: () => void;
  open: boolean;
  ratedBooksCount: number;
  triggerRef: RefObject<Nullable<HTMLSpanElement>>;
}) {
  const t = useTranslations("genres.card");
  const context = t("ratingContext", { count: ratedBooksCount, rating: averageRating });

  return (
    <Tooltip
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
      open={open}
    >
      <TooltipTrigger asChild>
        <span
          className="pointer-events-none inline-flex shrink-0 items-center gap-1 text-sm font-medium text-ink tabular-nums"
          data-slot="genre-card-rating"
          ref={triggerRef}
        >
          <UiIcon aria-hidden className="text-favorite" name="star-fill" size={14} />
          <span aria-hidden>{averageRating}</span>
          <span className="sr-only" id={contextId}>
            {context}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{context}</TooltipContent>
    </Tooltip>
  );
}

function isPointerOver(element: Nullable<HTMLElement>, event: PointerEvent): boolean {
  if (element === null) return false;
  const rect = element.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}
