"use client";

import type { QuoteBookPreview } from "@app/shared";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { QuoteCover } from "./quote-cover";

export function QuoteBookHeader({ book }: { book: QuoteBookPreview }) {
  const t = useTranslations("quotes.card");
  const bookHref = `/books/${book.id}`;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Link
        className="shrink-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        href={bookHref}
        tabIndex={-1}
      >
        <QuoteCover
          alt={t("coverAlt", { title: book.title })}
          className="aspect-[3/4] w-10"
          iconSize={16}
          sizes="40px"
          src={book.cover?.urls.thumb ?? null}
        />
      </Link>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="font-heading text-sm leading-snug font-semibold text-ink">
          <Link
            className="line-clamp-2 rounded-sm transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
            href={bookHref}
          >
            {book.title}
          </Link>
        </h3>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {book.firstAuthorName.length === 0 ? t("unknownAuthor") : book.firstAuthorName}
        </p>
      </div>
    </div>
  );
}
