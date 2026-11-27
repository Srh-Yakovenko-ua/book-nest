"use client";

import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { assertNever } from "@/lib/assert-never";

import type { HomeRecentBook, HomeRecentShelf } from "../model/home-recent-books";

import { HOME_LIBRARY_LINKS, homeBookHref } from "../model/home-library-links";
import { HomeBookCover } from "./home-book-cover";
import { HomeCard } from "./home-card";

export type HomeRecentBooksState = Exclude<HomeRecentShelf, { kind: "hidden" }>;

type HomeRecentBooksProps = {
  isRetrying: boolean;
  onRetry: () => void;
  state: HomeRecentBooksState;
};

const RECENT_ILLUSTRATION = {
  height: 216,
  src: "/illustrations/home/home-recent-books-gift.png",
  width: 360,
} as const;

const RECENT_SKELETON_KEYS = ["first", "second", "third"] as const;

export function HomeRecentBooks({ isRetrying, onRetry, state }: HomeRecentBooksProps) {
  const t = useTranslations("home.recent");

  return (
    <HomeCard
      action={
        <Link
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-md text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          href={HOME_LIBRARY_LINKS.newestBooks}
        >
          {t("allBooks")}
          <UiIcon aria-hidden name="arrow-right" size={16} />
        </Link>
      }
      icon="library-big"
      title={t("title")}
    >
      <RecentShelfBody isRetrying={isRetrying} onRetry={onRetry} state={state} />
    </HomeCard>
  );
}

function RecentBookItem({ item }: { item: HomeRecentBook }) {
  const t = useTranslations("home.recent");
  const locale = useLocale();
  const { book } = item;
  const authors = book.authors.map((author) => author.name).join(", ");
  const addedWhen = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    -item.addedDaysAgo,
    "day",
  );

  return (
    <li className="w-24 min-w-0 @sm/recent:w-28">
      <Link
        className="group flex h-full cursor-pointer flex-col gap-1.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        href={homeBookHref(book.id)}
      >
        <HomeBookCover
          className="w-full"
          cover={book.cover ?? null}
          seed={book.id}
          sizes="7rem"
          title={book.title}
        />
        <span className="line-clamp-2 text-sm leading-snug font-medium wrap-anywhere text-ink group-hover:text-primary">
          {book.title}
        </span>
        {authors.length === 0 ? null : (
          <span className="line-clamp-1 text-xs wrap-anywhere text-muted-foreground">
            {authors}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{t("added", { when: addedWhen })}</span>
      </Link>
    </li>
  );
}

function RecentShelfBody({ isRetrying, onRetry, state }: HomeRecentBooksProps) {
  const t = useTranslations("home.recent");
  const tCommon = useTranslations("common");

  switch (state.kind) {
    case "books":
      return (
        <div className="@container/recent flex min-w-0 flex-1 items-end gap-4">
          <ul className="flex min-w-0 gap-3 @lg/recent:shrink-0">
            {state.books.map((item) => (
              <RecentBookItem item={item} key={item.book.id} />
            ))}
          </ul>
          <Image
            alt=""
            aria-hidden
            className="pointer-events-none ml-auto hidden h-auto max-w-3/10 min-w-0 shrink basis-44 object-contain select-none @lg/recent:block"
            height={RECENT_ILLUSTRATION.height}
            loading="lazy"
            src={RECENT_ILLUSTRATION.src}
            unoptimized
            width={RECENT_ILLUSTRATION.width}
          />
        </div>
      );
    case "error":
      return (
        <div className="flex flex-col items-start gap-2" role="alert">
          <p className="flex items-start gap-2 text-sm text-foreground">
            <UiIcon
              aria-hidden
              className="mt-0.5 shrink-0 text-warning"
              name="alert-circle"
              size={16}
            />
            {t("error.title")}
          </p>
          <Button loading={isRetrying} onClick={onRetry} size="sm" variant="secondary">
            <UiIcon aria-hidden name="refresh" size={14} />
            {t("error.retry")}
          </Button>
        </div>
      );
    case "loading":
      return (
        <div aria-busy className="@container/recent flex min-w-0 gap-3">
          <span className="sr-only" role="status">
            {tCommon("loading")}
          </span>
          {RECENT_SKELETON_KEYS.map((key) => (
            <div className="flex w-24 min-w-0 flex-col gap-1.5 @sm/recent:w-28" key={key}>
              <Skeleton className="aspect-2/3 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          ))}
        </div>
      );
    default:
      return assertNever(state);
  }
}
