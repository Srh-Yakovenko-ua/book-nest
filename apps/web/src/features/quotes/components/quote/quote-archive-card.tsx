"use client";

import type { QuoteView } from "@app/shared";

import { cn } from "@/lib/utils";

import { QuoteActions } from "./quote-actions";
import { QuoteBody } from "./quote-body";
import { QuoteBookHeader } from "./quote-book-header";
import { QUOTE_CARD_SHELL } from "./quote-card-shell";
import { QuoteComment } from "./quote-comment";
import { QuoteMeta } from "./quote-meta";
import { QuoteSpoilerBadge } from "./quote-spoiler-badge";

export function QuoteArchiveCard({ quote }: { quote: QuoteView }) {
  const bookHref = `/books/${quote.bookId}`;

  return (
    <article className={cn(QUOTE_CARD_SHELL.base, QUOTE_CARD_SHELL.interactive)}>
      <div className="flex items-start gap-2">
        <QuoteBookHeader book={quote.book} />
        <QuoteActions bookHref={bookHref} className="ml-auto" quote={quote} />
      </div>

      <QuoteBody bookHref={bookHref} quote={quote} />

      <QuoteMeta quote={quote} trailing={quote.isSpoiler ? <QuoteSpoilerBadge /> : undefined} />

      <QuoteComment text={quote.comment} />
    </article>
  );
}
