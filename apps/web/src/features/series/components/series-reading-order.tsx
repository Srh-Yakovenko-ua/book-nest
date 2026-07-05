"use client";

import type { SeriesBookView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";

import { readingOrder } from "../model/series-details-derive";

type SeriesReadingOrderProps = {
  books: SeriesBookView[];
};

export function SeriesReadingOrder({ books }: SeriesReadingOrderProps) {
  const t = useTranslations("series.details.readingOrder");
  const ordered = readingOrder(books);

  if (ordered.length < 2) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <UiIcon className="text-icon" name="list" size={16} />
        {t("title")}
      </h3>
      <ol className="flex items-center gap-2 overflow-x-auto pb-1">
        {ordered.map((book, index) => (
          <li className="flex shrink-0 items-center gap-2" key={book.id}>
            {index === 0 ? null : (
              <UiIcon
                aria-hidden
                className="shrink-0 text-muted-foreground"
                name="arrow-right"
                size={14}
              />
            )}
            <Link
              className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-xs transition-colors hover:border-accent-border hover:bg-secondary"
              href={`/books/${book.id}`}
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent font-heading text-[0.6875rem] font-bold text-accent-foreground tabular-nums">
                {book.partNumber}
              </span>
              <span className="max-w-40 truncate font-medium text-foreground/90">{book.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
