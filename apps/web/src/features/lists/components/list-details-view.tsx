"use client";

import type { CustomListDetail } from "@app/shared";

import { useTranslations } from "next-intl";

import type { LibraryBookLabels } from "@/features/books/model/library-book";

import { UiIcon } from "@/components/icons";
import { BookCard } from "@/components/ui/book-card";
import { Button } from "@/components/ui/button";
import { useGenres } from "@/features/books/api/use-genres";
import { toLibraryBook } from "@/features/books/model/library-book";
import { Link } from "@/i18n/navigation";

type ListDetailsViewProps = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  pages: CustomListDetail[];
};

export function ListDetailsView({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  pages,
}: ListDetailsViewProps) {
  const t = useTranslations("lists.details");
  const tLibrary = useTranslations("books.library");
  const tStatus = useTranslations("books.readingStatus.options");
  const tOwnership = useTranslations("books.ownershipStatus.options");
  const genres = useGenres();

  const firstPage = pages[0];
  if (firstPage === undefined) return null;

  const genreNameByKey = new Map((genres.data ?? []).map((genre) => [genre.key, genre.name]));

  const labels: LibraryBookLabels = {
    borrowedFrom: (name) => tLibrary("card.borrowedFrom", { name }),
    genreName: (key) => genreNameByKey.get(key) ?? key,
    lentTo: (name) => tLibrary("card.lentTo", { name }),
    ownershipLabel: (value) => tOwnership(value),
    pagesText: (value) => tLibrary("meta.pages", { value }),
    progressAriaLabel: (current, total) => tLibrary("progress.ariaLabel", { current, total }),
    progressUnit: tLibrary("progress.unit"),
    ratingLabel: (value) => tLibrary("rating.ariaLabel", { value }),
    statusLabel: (value) => tStatus(value),
  };

  const books = pages
    .flatMap((page) => page.books.items)
    .map((book) => toLibraryBook(book, labels));

  return (
    <div className="flex flex-col gap-6 motion-safe:animate-in motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:fade-in motion-safe:slide-in-from-bottom-2 lg:gap-8">
      <Link
        className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        href="/my-library"
      >
        <UiIcon name="arrow-left" size={16} />
        {t("back")}
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl font-semibold text-ink">{firstPage.name}</h1>
        {firstPage.description === null ? null : (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {firstPage.description}
          </p>
        )}
        <p className="text-sm text-muted-foreground tabular-nums">
          {t("books", { count: firstPage.bookCount })}
        </p>
      </header>

      {books.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border px-6 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-accent text-icon">
            <UiIcon name="list" size={24} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-ink">{t("empty.title")}</p>
            <p className="text-sm text-muted-foreground">{t("empty.description")}</p>
          </div>
        </div>
      ) : (
        <section className="flex flex-col gap-6 lg:gap-8">
          <h2 className="sr-only">{t("booksHeading")}</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[repeat(auto-fill,minmax(19rem,1fr))]">
            {books.map((book) => (
              <BookCard
                authors={book.authors}
                cover={book.cover}
                genres={book.genres}
                href={book.href}
                key={book.id}
                linkComponent={Link}
                ownership={book.ownership}
                progress={book.progress}
                publisher={book.publisher}
                rating={book.rating}
                ratingLabel={book.ratingLabel}
                series={book.series}
                status={book.status}
                tags={book.tags}
                title={book.title}
              />
            ))}
          </div>
          {hasNextPage ? (
            <div className="flex justify-center">
              <Button
                disabled={isFetchingNextPage}
                loading={isFetchingNextPage}
                onClick={onLoadMore}
                variant="secondary"
              >
                {t("loadMore")}
              </Button>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
