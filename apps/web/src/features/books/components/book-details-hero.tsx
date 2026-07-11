"use client";

import type { BookView, ReadingStatus } from "@app/shared";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { GenreIcon, isGenreIconName, UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { RatingScore } from "@/components/ui/rating-score";
import { StatusBadge, statusBadgeVariants } from "@/components/ui/status-badge";
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

export function BookDetailsHero({ book }: BookDetailsHeroProps) {
  const t = useTranslations("books");
  const favorite = useToggleFavorite();
  const [authorsExpanded, setAuthorsExpanded] = useState(false);

  const dedicationId = useId();
  const [dedicationExpanded, setDedicationExpanded] = useState(false);
  const dedicationContainerRef = useRef<HTMLDivElement>(null);
  const dedicationContentRef = useRef<HTMLQuoteElement>(null);
  const previousDedicationExpanded = useRef<boolean | null>(null);

  const dedication = book.dedication?.trim() ?? "";
  const isDedicationLong = dedication.length > DEDICATION_PREVIEW;
  const hasDedication = dedication.length > 0;
  const hasGenres = book.genres.length > 0;

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
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-7">
        <div className="flex shrink-0 flex-col gap-4">
          <BookDetailsCover
            alt={t("details.coverAlt", { title: book.title })}
            src={book.cover?.urls.card}
            title={book.title}
          />
          {hasGenres && hasDedication ? (
            <div className="mx-auto w-[210px] sm:mx-0">
              <GenreList genreNameByKey={genreNameByKey} genres={book.genres} />
            </div>
          ) : null}
        </div>

        <div className="hero-content-branch flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-2">
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
            <div className="flex items-start justify-between gap-4">
              <h1 className="min-w-0 font-heading text-3xl leading-[1.1] font-semibold tracking-tight text-ink md:text-[2.625rem]">
                {book.title}
              </h1>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  aria-label={isFavorite ? t("details.favorite.remove") : t("details.favorite.add")}
                  aria-pressed={isFavorite}
                  className={cn(
                    "rounded-lg border-[1.5px] transition-all duration-[180ms] ease-out",
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
                <BookDetailsActionsMenu book={book} />
              </div>
            </div>
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

          {hasDedication ? (
            <div className="mt-2">
              <div className="relative overflow-hidden rounded-r-[14px] border-l-[3px] border-l-[var(--terracotta)] bg-muted py-3 pr-4 pl-4">
                <div
                  aria-hidden
                  className="pointer-events-none absolute right-0 -bottom-4 z-20 aspect-square w-20 opacity-70 select-none lg:w-24"
                >
                  <Image
                    alt=""
                    className="object-contain"
                    fill
                    sizes="96px"
                    src="/illustrations/book-detail-1.png"
                    unoptimized
                  />
                </div>
                <p className="relative z-10 mb-1.5 text-[11px] font-semibold tracking-wider text-[var(--terracotta-dark)] uppercase">
                  {t("details.dedicationLabel")}
                </p>
                <div className="relative z-10">
                  <div
                    className="overflow-hidden motion-safe:transition-[max-height] motion-safe:duration-300 motion-safe:ease-out"
                    ref={dedicationContainerRef}
                  >
                    <blockquote
                      className="text-sm leading-relaxed whitespace-pre-line text-[var(--ink-soft)] italic"
                      id={dedicationId}
                      ref={dedicationContentRef}
                    >
                      {dedication}
                    </blockquote>
                  </div>
                  {isDedicationLong && !dedicationExpanded ? (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-muted to-transparent"
                    />
                  ) : null}
                </div>
                {isDedicationLong ? (
                  <button
                    aria-controls={dedicationId}
                    aria-expanded={dedicationExpanded}
                    className="relative z-10 mt-2 inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-primary hover:text-primary/80"
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
              </div>
            </div>
          ) : hasGenres ? (
            <div className="mt-2">
              <GenreList genreNameByKey={genreNameByKey} genres={book.genres} />
            </div>
          ) : null}
        </div>
      </div>

      {book.tags.length === 0 ? null : (
        <ul className="flex flex-wrap gap-1.5 border-t border-[color-mix(in_srgb,var(--border)_70%,transparent)] pt-4">
          {book.tags.map((tag) => (
            <li
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-medium text-foreground/80"
              key={tag.id}
            >
              <UiIcon className="shrink-0 text-muted-foreground" name="hash" size={12} />
              <span className="min-w-0 truncate">{tag.name}</span>
            </li>
          ))}
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
    <div className="relative mx-auto aspect-[3/4] w-[210px] shrink-0 overflow-hidden rounded-xl bg-accent shadow-detail-cover sm:mx-0">
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
          sizes="210px"
          src={src}
          unoptimized
        />
      )}
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
