"use client";

import type { CharacterAppearanceBook } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import type { InfiniteScrollState } from "@/hooks/use-infinite-scroll-sentinel";

import { UiIcon } from "@/components/icons";
import { InfiniteScrollFooter } from "@/components/infinite-scroll-footer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";

import type { useCharacterBooks } from "../api/use-character-books";

import { CHARACTER_GLOBAL_VIEW, getCharacterDetailsPath } from "../model/character-routes";
import { CharacterBookCover } from "./character-book-cover";

const BOOKS_LIST = {
  skeletonRows: 4,
} as const;

type CharacterBooksListProps = {
  character: { appearanceCount: number; id: string; name: string };
  query: CharacterBooksQuery;
  title: ReactNode;
};

type CharacterBooksQuery = ReturnType<typeof useCharacterBooks>;

export function CharacterBooksList({ character, query, title }: CharacterBooksListProps) {
  const t = useTranslations("characters.catalog.books");
  const totalCount = query.data?.pages[0]?.totalCount ?? character.appearanceCount;
  const profileHref = getCharacterDetailsPath({
    characterId: character.id,
    view: CHARACTER_GLOBAL_VIEW,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-1 border-b border-border px-4 py-3">
        {title}
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
          <span className="font-medium wrap-anywhere text-foreground">{character.name}</span>
          <span>{t("total", { count: totalCount })}</span>
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 lg:max-h-96">
        <CharacterBooksBody query={query} />
      </div>

      <footer className="border-t border-border px-4 pt-3 safe-bottom">
        <Button asChild className="w-full max-lg:h-11" size="lg" variant="secondary">
          <Link href={profileHref}>
            {t("openProfile")}
            <UiIcon name="arrow-right" size={16} />
          </Link>
        </Button>
      </footer>
    </div>
  );
}

function CharacterBookRow({ book }: { book: CharacterAppearanceBook }) {
  const tPage = useTranslations("characters.page");

  return (
    <li>
      <Link
        className="flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 transition-colors outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
        href={`/books/${book.id}`}
      >
        <CharacterBookCover className="w-10" cover={book.cover} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="line-clamp-2 text-sm font-medium wrap-anywhere text-foreground">
            {book.title}
          </span>
          {book.series === null ? null : (
            <span className="line-clamp-1 text-xs wrap-anywhere text-muted-foreground">
              {book.series.partNumber === null
                ? book.series.name
                : tPage("seriesPart", { name: book.series.name, part: book.series.partNumber })}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}

function CharacterBooksBody({ query }: { query: CharacterBooksQuery }) {
  const t = useTranslations("characters.catalog.books");
  const tCommon = useTranslations("common");

  if (query.data === undefined && query.isError) {
    return (
      <div className="flex flex-col items-center gap-3 px-2 py-6 text-center" role="alert">
        <p className="text-sm text-error">{t("error")}</p>
        <Button onClick={() => void query.refetch()} size="sm" variant="secondary">
          <UiIcon name="refresh" size={14} />
          {tCommon("retry")}
        </Button>
      </div>
    );
  }

  if (query.data === undefined) return <CharacterBooksSkeleton />;

  const books = query.data.pages.flatMap((page) => page.items);

  if (books.length === 0) {
    return <p className="px-2 py-6 text-center text-sm text-muted-foreground">{t("none")}</p>;
  }

  const loadMoreState: InfiniteScrollState = query.isFetchNextPageError
    ? "error"
    : query.isFetchingNextPage
      ? "loading"
      : query.hasNextPage
        ? "idle"
        : "none";

  function loadMore() {
    if (query.isFetchingNextPage) return;
    void query.fetchNextPage();
  }

  return (
    <>
      <ul className="flex flex-col gap-0.5">
        {books.map((book) => (
          <CharacterBookRow book={book} key={book.id} />
        ))}
      </ul>
      <InfiniteScrollFooter
        className="mt-2"
        errorLabel={t("loadMoreError")}
        onLoadMore={loadMore}
        state={loadMoreState}
      />
    </>
  );
}

function CharacterBooksSkeleton() {
  const t = useTranslations("characters.catalog.books");

  return (
    <div aria-busy className="flex flex-col gap-0.5" role="status">
      <span className="sr-only">{t("loading")}</span>
      {Array.from({ length: BOOKS_LIST.skeletonRows }, (_unused, index) => (
        <div className="flex min-h-11 items-center gap-3 px-2 py-2" key={index}>
          <Skeleton className="aspect-3/4 w-10 shrink-0 rounded-sm" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
