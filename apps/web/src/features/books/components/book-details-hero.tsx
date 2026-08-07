"use client";

import type { BookView, ReadingStatus } from "@app/shared";

import { ArrowRight, ChevronDown, Quote } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { GenreIcon, isGenreIconName, UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { RatingScore } from "@/components/ui/rating-score";
import { StatusBadge, statusBadgeVariants } from "@/components/ui/status-badge";
import { useDedicationActions } from "@/features/dedications";
import { Link } from "@/i18n/navigation";
import { readingStatuses } from "@/lib/book-status";
import { cn } from "@/lib/utils";

import { useToggleFavorite } from "../api/use-book-actions";
import { useGenres } from "../api/use-genres";
import { useReadingQueuePosition } from "../api/use-reading-queue";
import { resolveReadingProgress } from "../model/reading-progress";
import { BookDetailsActionsMenu } from "./book-details-actions-menu";

type BookDetailsHeroProps = {
  book: BookView;
};

const PROGRESS_STATUSES: readonly ReadingStatus[] = ["reading", "paused", "rereading"];

const DEDICATION_PREVIEW = 300;

const MOBILE_HERO_LIMITS = {
  dedicationChars: 120,
  tagsShown: 4,
} as const;

export function BookDetailsHero({ book }: BookDetailsHeroProps) {
  const t = useTranslations("books");
  const favorite = useToggleFavorite();
  const [authorsExpanded, setAuthorsExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const dedicationId = useId();
  const [dedicationExpanded, setDedicationExpanded] = useState(false);
  const dedicationContainerRef = useRef<HTMLDivElement>(null);
  const dedicationContentRef = useRef<HTMLQuoteElement>(null);
  const previousDedicationExpanded = useRef<boolean | null>(null);

  const dedication = book.dedication?.trim() ?? "";
  const isDedicationLong = dedication.length > DEDICATION_PREVIEW;
  const isDedicationClamped = dedication.length > MOBILE_HERO_LIMITS.dedicationChars;
  const hasDedication = dedication.length > 0;
  const hasGenres = book.genres.length > 0;
  const hiddenTagsCount = book.tags.length - MOBILE_HERO_LIMITS.tagsShown;

  useLayoutEffect(() => {
    const container = dedicationContainerRef.current;
    const content = dedicationContentRef.current;
    if (container === null || content === null) return;

    if (!isDedicationLong) {
      container.style.maxHeight = "none";
      previousDedicationExpanded.current = null;
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let removeTransitionEnd: (() => void) | undefined;

    const collapsedHeight = () => {
      const node = content.firstChild;
      if (node === null || node.nodeType !== Node.TEXT_NODE) return content.scrollHeight;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, Math.min(DEDICATION_PREVIEW, dedication.length));
      const rects = range.getClientRects();
      const lastRect = rects.item(rects.length - 1);
      if (lastRect === null) return content.scrollHeight;
      return Math.ceil(lastRect.bottom - content.getBoundingClientRect().top);
    };

    const settleAtRest = (collapsed: number) => {
      container.style.maxHeight = dedicationExpanded ? "none" : `${collapsed}px`;
    };

    const animate = (collapsed: number) => {
      removeTransitionEnd?.();
      if (reducedMotion.matches) {
        settleAtRest(collapsed);
        return;
      }
      if (dedicationExpanded) {
        container.style.maxHeight = `${content.scrollHeight}px`;
        const handleEnd = (event: TransitionEvent) => {
          if (event.propertyName !== "max-height") return;
          container.style.maxHeight = "none";
          container.removeEventListener("transitionend", handleEnd);
        };
        container.addEventListener("transitionend", handleEnd);
        removeTransitionEnd = () => container.removeEventListener("transitionend", handleEnd);
        return;
      }
      container.style.maxHeight = `${content.scrollHeight}px`;
      void container.offsetHeight;
      container.style.maxHeight = `${collapsed}px`;
    };

    const toggled =
      previousDedicationExpanded.current !== null &&
      previousDedicationExpanded.current !== dedicationExpanded;
    previousDedicationExpanded.current = dedicationExpanded;
    if (toggled) {
      animate(collapsedHeight());
    } else {
      settleAtRest(collapsedHeight());
    }

    const observer = new ResizeObserver(() => {
      if (!dedicationExpanded) container.style.maxHeight = `${collapsedHeight()}px`;
    });
    observer.observe(content);

    return () => {
      observer.disconnect();
      removeTransitionEnd?.();
    };
  }, [dedicationExpanded, dedication, isDedicationLong]);

  const isFavorite =
    favorite.isPending && favorite.variables !== undefined
      ? favorite.variables.isFavorite
      : book.isFavorite;

  const hasHiddenAuthors = book.authors.length > 2;
  const shownAuthorNames = (
    authorsExpanded || !hasHiddenAuthors ? book.authors : book.authors.slice(0, 2)
  )
    .map((author) => author.name)
    .join(", ");
  const rating = book.readingProgress?.rating ?? null;
  const progress = PROGRESS_STATUSES.includes(book.readingStatus)
    ? resolveReadingProgress(book)
    : null;
  const readingBase = readingStatuses.find((entry) => entry.value === book.readingStatus);
  const queuePosition = useReadingQueuePosition(book);
  const genres = useGenres();
  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

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
    <section className="relative flex flex-col gap-6 overflow-hidden rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-detail-block md:p-7">
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-start gap-x-4 gap-y-2 [grid-template-areas:'meta_meta''cover_headline''rich_rich'] sm:grid-cols-[210px_minmax(0,1fr)] sm:gap-x-7 sm:[grid-template-areas:'cover_meta''cover_headline''cover_rich']">
        <div className="mb-1 flex items-start justify-between gap-3 [grid-area:meta] sm:mb-0">
          <div className="flex flex-wrap items-center gap-2">
            {readingBase === undefined ? null : (
              <StatusBadge
                entry={{
                  ...readingBase,
                  label: t(`readingStatus.options.${book.readingStatus}`),
                }}
              />
            )}
            {book.isInReadingQueue ? (
              <StatusBadge
                entry={{
                  icon: "list",
                  label:
                    queuePosition === null
                      ? t("details.queue.inQueue")
                      : t("details.queue.inQueuePosition", { position: queuePosition }),
                  tone: "info",
                  value: "in_queue",
                }}
              />
            ) : null}
            {progress !== null &&
            (book.readingStatus === "reading" || book.readingStatus === "rereading") ? (
              <span className="text-sm font-semibold text-primary tabular-nums">
                {progress.percent}%
              </span>
            ) : null}
            {book.ageCategory === "18_plus" ? (
              <span className={statusBadgeVariants({ tone: "danger" })}>
                {t("classification.ageCategoryLabels.18_plus")}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              aria-label={isFavorite ? t("details.favorite.remove") : t("details.favorite.add")}
              aria-pressed={isFavorite}
              className={cn(
                "rounded-lg border-[1.5px] transition-all duration-[180ms] ease-out max-sm:size-10",
                isFavorite
                  ? "border-brand bg-brand text-white shadow-btn hover:border-primary-hover hover:bg-primary-hover hover:text-white dark:hover:bg-primary-hover [&_svg]:animate-[heart-pop_320ms_ease]"
                  : "border-border bg-card text-muted-foreground hover:border-brand hover:bg-accent hover:text-brand dark:hover:bg-accent",
              )}
              disabled={favorite.isPending}
              onClick={toggleFavorite}
              size="icon"
              variant="ghost"
            >
              <UiIcon name={isFavorite ? "heart-fill" : "heart"} size={18} />
            </Button>
            <BookDetailsActionsMenu book={book} className="max-sm:size-10" />
          </div>
        </div>

        <div className="[grid-area:cover]">
          <BookDetailsCover
            alt={t("details.coverAlt", { title: book.title })}
            src={book.cover?.urls.card}
            title={book.title}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4 [grid-area:headline] sm:hero-content-branch">
          <div className="flex flex-col gap-2">
            <h1 className="min-w-0 font-heading text-[1.375rem] leading-[1.15] font-semibold tracking-tight text-ink max-sm:line-clamp-3 sm:text-3xl sm:leading-[1.1] md:text-[2.625rem]">
              {book.title}
            </h1>
            {book.originalTitle === null ? null : (
              <p className="mb-2 text-sm text-muted-foreground italic">{book.originalTitle}</p>
            )}
            {book.authors.length > 0 ? (
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-foreground/90">
                <UiIcon className="shrink-0" name="user" size={15} />
                <span>{shownAuthorNames}</span>
                {hasHiddenAuthors ? (
                  <button
                    aria-expanded={authorsExpanded}
                    aria-label={
                      authorsExpanded ? t("details.authorsCollapse") : t("details.authorsShowAll")
                    }
                    className="inline-flex cursor-pointer items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    onClick={() => setAuthorsExpanded((value) => !value)}
                    type="button"
                  >
                    {authorsExpanded ? t("details.authorsCollapse") : `+${book.authors.length - 2}`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {rating === null ? null : (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <RatingScore value={rating} />
            </div>
          )}
        </div>

        <div className="mt-3 min-w-0 [grid-area:rich]">
          {hasDedication ? (
            <div className="rounded-[14px] border-l-2 border-l-[var(--terracotta)] bg-muted/50 p-3.5 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-3 sm:mb-2.5">
                <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                  <Quote aria-hidden className="size-4 shrink-0 text-[var(--terracotta)]" />
                  <span className="truncate text-sm font-medium">
                    {t("details.dedicationLabel")}
                  </span>
                </div>
                <Link
                  className="inline-flex shrink-0 items-center gap-1 rounded text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  href="/dedications"
                >
                  {t("details.dedicationAllLink")}
                  <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              </div>
              <div className="relative">
                <div
                  className="overflow-hidden motion-safe:transition-[max-height] motion-safe:duration-300 motion-safe:ease-out max-sm:max-h-none!"
                  ref={dedicationContainerRef}
                >
                  <blockquote
                    className={cn(
                      "text-sm leading-6 whitespace-pre-line text-foreground/90 italic sm:leading-7",
                      dedicationExpanded ? null : "max-sm:line-clamp-4",
                    )}
                    id={dedicationId}
                    ref={dedicationContentRef}
                  >
                    {dedication}
                  </blockquote>
                </div>
                {isDedicationLong && !dedicationExpanded ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-muted/50 to-transparent max-sm:hidden"
                  />
                ) : null}
              </div>
              {isDedicationClamped ? (
                <button
                  aria-controls={dedicationId}
                  aria-expanded={dedicationExpanded}
                  className={cn(
                    "mt-2 inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-primary hover:text-primary/80",
                    isDedicationLong ? null : "sm:hidden",
                  )}
                  onClick={() => setDedicationExpanded((value) => !value)}
                  type="button"
                >
                  {dedicationExpanded ? t("details.about.showLess") : t("details.about.showMore")}
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-4 transition-transform",
                      dedicationExpanded && "rotate-180",
                    )}
                  />
                </button>
              ) : null}
              <DedicationActions book={book} dedication={dedication} />
            </div>
          ) : hasGenres ? (
            <GenreList genreNameByKey={genreNameByKey} genres={book.genres} />
          ) : null}
        </div>
      </div>

      {book.tags.length === 0 ? null : (
        <ul className="flex flex-wrap gap-1.5 border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] pt-4">
          {book.tags.map((tag, index) => (
            <li
              className={cn(
                "inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground/80",
                !tagsExpanded && index >= MOBILE_HERO_LIMITS.tagsShown && "max-sm:hidden",
              )}
              key={tag.id}
            >
              <UiIcon className="shrink-0 text-muted-foreground" name="hash" size={12} />
              <span className="min-w-0 truncate">{tag.name}</span>
            </li>
          ))}
          {hiddenTagsCount > 0 && !tagsExpanded ? (
            <li className="sm:hidden">
              <button
                aria-label={t("details.tagsShowAll")}
                className="inline-flex cursor-pointer items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                onClick={() => setTagsExpanded(true)}
                type="button"
              >
                {`+${hiddenTagsCount}`}
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function BookDetailsCover({ alt, src, title }: { alt: string; src?: string; title: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const initial = title.trim().charAt(0).toUpperCase();

  return (
    <div className="relative aspect-[3/4] w-28 shrink-0 overflow-hidden rounded-xl bg-accent shadow-detail-cover sm:w-[210px]">
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
          sizes="(min-width: 640px) 210px, 112px"
          src={src}
          unoptimized
        />
      )}
    </div>
  );
}

function DedicationActions({ book, dedication }: { book: BookView; dedication: string }) {
  const t = useTranslations("books.details");
  const { copy, isTogglingFavorite, toggleFavorite } = useDedicationActions();

  return (
    <div className="mt-3 flex flex-wrap items-center gap-1">
      <Button onClick={() => void copy(dedication)} size="sm" variant="ghost">
        <UiIcon name="copy" size={15} />
        {t("dedicationCopy")}
      </Button>
      <Button
        aria-pressed={book.isFavoriteDedication}
        disabled={isTogglingFavorite}
        onClick={() => toggleFavorite(book)}
        size="sm"
        variant="ghost"
      >
        <UiIcon
          className={book.isFavoriteDedication ? "text-primary" : undefined}
          name="bookmark"
          size={15}
        />
        {book.isFavoriteDedication ? t("dedicationSaved") : t("dedicationSave")}
      </Button>
    </div>
  );
}

function GenreList({
  genreNameByKey,
  genres,
}: {
  genreNameByKey: Map<string, string>;
  genres: readonly string[];
}) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {genres.map((key) => (
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
    </ul>
  );
}
