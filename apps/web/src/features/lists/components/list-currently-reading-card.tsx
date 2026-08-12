"use client";

import type { ListBookView, ListOverviewView, Nullable } from "@app/shared";

import { useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";

import { ListSidebarCard } from "./list-sidebar";

type ReadingPosition =
  | { currentPage: number; kind: "page" }
  | { currentPage: number; kind: "percent"; pagesCount: number; percent: number }
  | { kind: "none" };

export function ListCurrentlyReadingCard({ overview }: { overview: Nullable<ListOverviewView> }) {
  const t = useTranslations("lists.details.sidebar.currentlyReading");
  const currentlyReading = overview?.currentlyReading ?? null;

  if (currentlyReading === null) return null;

  const { book, othersCount } = currentlyReading;
  const href = `/books/${book.id}`;
  const authors = book.authors.map((author) => author.name).join(", ");
  const position = readingPosition(book);

  return (
    <ListSidebarCard icon="book" title={t("title")}>
      <Link
        className="group/book -mx-1.5 flex cursor-pointer items-start gap-3 rounded-lg p-1.5 no-underline transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50"
        href={href}
      >
        <BookCover book={book} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm font-medium text-ink transition-colors group-hover/book:text-primary">
            {book.title}
          </span>
          <span className="line-clamp-1 text-xs text-muted-foreground">
            {authors === "" ? t("unknownAuthor") : authors}
          </span>
        </span>
      </Link>

      {position.kind === "none" ? null : (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground tabular-nums">
            {position.kind === "percent"
              ? t("progress", {
                  current: position.currentPage,
                  percent: position.percent,
                  total: position.pagesCount,
                })
              : t("progressPage", { current: position.currentPage })}
          </p>
          {position.kind === "percent" ? (
            <Progress
              aria-label={t("progressLabel", { percent: position.percent })}
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={position.percent}
              className="h-1.5"
              value={position.percent}
            />
          ) : null}
        </div>
      )}

      {othersCount === 0 ? null : (
        <p className="text-xs text-muted-foreground">{t("others", { count: othersCount })}</p>
      )}
    </ListSidebarCard>
  );
}

function BookCover({ book }: { book: ListBookView }) {
  const t = useTranslations("lists.details.sidebar.currentlyReading");
  const cover = book.cover ?? null;

  if (cover === null) {
    return (
      <span
        aria-hidden
        className="grid aspect-[2/3] w-14 shrink-0 place-items-center rounded-md border border-border bg-accent text-accent-foreground/50"
      >
        <UiIcon name="book" size={18} />
      </span>
    );
  }

  return (
    <Image
      alt={t("coverAlt", { title: book.title })}
      className="aspect-[2/3] w-14 shrink-0 rounded-md border border-border object-cover"
      height={84}
      src={cover.urls.thumb}
      unoptimized
      width={56}
    />
  );
}

function readingPosition(book: ListBookView): ReadingPosition {
  const currentPage = book.readingProgress?.currentPage ?? null;
  if (currentPage === null) return { kind: "none" };

  const pagesCount = book.pagesCount;
  if (pagesCount === null || pagesCount <= 0) return { currentPage, kind: "page" };

  return {
    currentPage,
    kind: "percent",
    pagesCount,
    percent: Math.min(100, Math.round((currentPage / pagesCount) * 100)),
  };
}
