"use client";

import type { HomeActiveBooksPage, Nullable } from "@app/shared";
import type { KeyboardEvent, ReactNode } from "react";

import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useBook } from "@/features/books";

import type { HomeActiveBookDialog } from "../model/home-active-book-dialog";

import { useHomeActiveBooks } from "../api/use-home-active-books";
import {
  homeActiveBookDialogTarget,
  openHomeActiveBookDialog,
} from "../model/home-active-book-dialog";
import { clampCarouselIndex, homeCarouselWindow } from "../model/home-active-books";
import { HomeActiveBookCard } from "./home-active-book-card";
import { HomeActiveBookDialogs } from "./home-active-book-dialogs";

type HomeActiveBooksCarouselProps = {
  empty: ReactNode;
  initialPage: HomeActiveBooksPage;
  initialPageUpdatedAt: number;
  today: string;
};

const VISIBLE_THRESHOLD = 0.6;

export function HomeActiveBooksCarousel({
  empty,
  initialPage,
  initialPageUpdatedAt,
  today,
}: HomeActiveBooksCarouselProps) {
  const t = useTranslations("home.reading.carousel");
  const activeBooks = useHomeActiveBooks({ initialPage, initialPageUpdatedAt });
  const [dialog, setDialog] = useState<HomeActiveBookDialog>({ kind: "closed" });
  const [visible, setVisible] = useState<Nullable<readonly number[]>>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  const focusedBookId = useRef<Nullable<string>>(null);

  const dialogTarget = homeActiveBookDialogTarget(dialog);
  const dialogBook = useBook(dialogTarget ?? "", { enabled: dialogTarget !== null });
  const isOpeningDialog =
    dialogTarget !== null && dialogBook.data === undefined && !dialogBook.isError;

  const { books } = activeBooks;
  const bookIds = books.map((book) => book.id).join(" ");
  const carousel = homeCarouselWindow({
    count: books.length,
    hasMore: activeBooks.hasNextPage,
    visible: visible ?? [],
  });
  const hasControls = visible !== null && (carousel.canGoNext || carousel.canGoPrevious);

  const onVisibleChange = useEffectEvent((shown: readonly number[]) => {
    setVisible(shown);
    const next = homeCarouselWindow({
      count: books.length,
      hasMore: activeBooks.hasNextPage,
      visible: shown,
    });
    if (next.shouldLoadMore) activeBooks.fetchNextPage();
  });

  useEffect(() => {
    const track = trackRef.current;
    if (track === null) return;

    const indexBySlide = new Map<Element, number>();
    Array.from(track.children).forEach((slide, index) => indexBySlide.set(slide, index));
    const shown = new Set<number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = indexBySlide.get(entry.target);
          if (index === undefined) continue;
          if (entry.isIntersecting) shown.add(index);
          else shown.delete(index);
        }
        onVisibleChange([...shown].sort((left, right) => left - right));
      },
      { root: track, threshold: VISIBLE_THRESHOLD },
    );
    indexBySlide.forEach((_, slide) => observer.observe(slide));
    return () => observer.disconnect();
  }, [bookIds]);

  useEffect(() => {
    const focused = focusedBookId.current;
    if (focused === null || bookIds.split(" ").includes(focused)) return;
    focusedBookId.current = null;
    const active = document.activeElement;
    if (active === null || active === document.body) regionRef.current?.focus();
  }, [bookIds]);

  function scrollToSlide(index: number) {
    const track = trackRef.current;
    if (track === null) return;
    const slide = track.children.item(clampCarouselIndex({ count: books.length, index }));
    if (!(slide instanceof HTMLElement)) return;
    track.scrollTo({ left: slide.offsetLeft });
  }

  function goPrevious() {
    if (!carousel.canGoPrevious) return;
    scrollToSlide(carousel.first - 1);
  }

  function goNext() {
    if (carousel.last < books.length - 1) {
      scrollToSlide(carousel.first + 1);
      return;
    }
    activeBooks.fetchNextPage();
  }

  function navigateWithKeys(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goPrevious();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goNext();
    }
  }

  const positionText =
    carousel.first === carousel.last
      ? t("position", { current: carousel.first + 1, total: activeBooks.total })
      : t("range", {
          first: carousel.first + 1,
          last: carousel.last + 1,
          total: activeBooks.total,
        });

  return (
    <>
      {books.length === 0 ? (
        empty
      ) : (
        <div
          aria-label={t("label")}
          aria-roledescription={t("roleDescription")}
          className="@container/reading flex min-w-0 flex-1 flex-col gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          ref={regionRef}
          role="group"
          tabIndex={-1}
        >
          <div
            className="relative -mx-1.5 no-scrollbar flex min-w-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth motion-reduce:scroll-auto"
            ref={trackRef}
          >
            {books.map((book, index) => (
              <div
                aria-label={t("slide", { current: index + 1, total: activeBooks.total })}
                aria-roledescription={t("slideRoleDescription")}
                className={
                  books.length === 1
                    ? "flex w-full shrink-0 snap-start px-1.5"
                    : "flex w-full shrink-0 snap-start px-1.5 @xl/reading:w-1/2"
                }
                key={book.id}
                onFocus={() => {
                  focusedBookId.current = book.id;
                }}
                role="group"
              >
                <HomeActiveBookCard
                  book={book}
                  isOpening={isOpeningDialog && dialogTarget === book.id}
                  onAction={(action) =>
                    setDialog(openHomeActiveBookDialog({ action, bookId: book.id }))
                  }
                  today={today}
                />
              </div>
            ))}
          </div>
          {hasControls ? (
            <div className="flex items-center justify-between gap-2">
              <p aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
                {positionText}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  aria-label={t("previous")}
                  disabled={!carousel.canGoPrevious}
                  onClick={goPrevious}
                  onKeyDown={navigateWithKeys}
                  size="icon-sm"
                  variant="outline"
                >
                  <UiIcon aria-hidden name="chevron-left" size={16} />
                </Button>
                <Button
                  aria-label={t("next")}
                  disabled={!carousel.canGoNext}
                  loading={activeBooks.isFetchingNextPage}
                  onClick={goNext}
                  onKeyDown={navigateWithKeys}
                  size="icon-sm"
                  variant="outline"
                >
                  <UiIcon aria-hidden name="chevron-right" size={16} />
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <HomeActiveBookDialogs
        book={dialogBook.data}
        dialog={dialog}
        isError={dialogBook.isError}
        isRetrying={dialogBook.isFetching}
        onClose={() => setDialog({ kind: "closed" })}
        onRetry={() => void dialogBook.refetch()}
      />
    </>
  );
}
