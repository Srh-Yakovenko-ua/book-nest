"use client";

import type { ReadingGoalBook } from "@app/shared";

import { compareAsc, parseISO } from "date-fns";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/format";

type GoalCountedBooksProps = {
  books: ReadingGoalBook[];
};

export function GoalCountedBooks({ books }: GoalCountedBooksProps) {
  const t = useTranslations("goals.detail");
  const ordered = [...books].sort((left, right) =>
    compareAsc(parseISO(left.finishedAt), parseISO(right.finishedAt)),
  );

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-base font-semibold text-ink">
        {t("countedBooks", { count: books.length })}
      </h2>

      {ordered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-accent text-icon">
            <UiIcon name="book" size={24} />
          </span>
          <p className="text-sm font-medium text-ink">{t("countedEmpty")}</p>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            {t("countedEmptyHint")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordered.map((book) => (
            <CountedBookRow book={book} key={book.id} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BookCover({ book }: { book: ReadingGoalBook }) {
  const t = useTranslations("goals.detail");

  if (book.cover === null) {
    return (
      <div className="grid aspect-[3/4] w-10 shrink-0 place-items-center rounded-sm bg-accent text-icon">
        <UiIcon name="book" size={16} />
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] w-10 shrink-0 overflow-hidden rounded-sm bg-accent">
      <Image
        alt={t("coverAlt", { title: book.title })}
        className="object-cover"
        fill
        sizes="40px"
        src={book.cover.urls.thumb}
        unoptimized
      />
    </div>
  );
}

function CountedBookRow({ book }: { book: ReadingGoalBook }) {
  const t = useTranslations("goals.detail");
  const locale = useLocale();
  const authors = book.authors.map((author) => author.name).join(", ");

  return (
    <li>
      <Link
        className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 no-underline transition-colors outline-none hover:border-accent-border hover:bg-accent/40 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50"
        href={`/books/${book.id}`}
      >
        <BookCover book={book} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm leading-snug font-medium text-ink group-hover:text-primary">
            {book.title}
          </p>
          {authors === "" ? null : (
            <p className="truncate text-xs text-muted-foreground">{authors}</p>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("finishedOn", { date: formatDate(book.finishedAt, locale) })}
        </span>
      </Link>
    </li>
  );
}
