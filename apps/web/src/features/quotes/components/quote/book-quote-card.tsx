"use client";

import type { QuoteView } from "@app/shared";

import { cn } from "@/lib/utils";

import { QuoteActions } from "./quote-actions";
import { QuoteBody } from "./quote-body";
import { QUOTE_CARD_SHELL } from "./quote-card-shell";
import { QuoteComment } from "./quote-comment";
import { QuoteMeta } from "./quote-meta";
import { QuoteSpoilerBadge } from "./quote-spoiler-badge";

type BookQuoteCardProps = {
  maxPage?: number;
  quote: QuoteView;
};

export function BookQuoteCard({ maxPage, quote }: BookQuoteCardProps) {
  return (
    <article className={cn(QUOTE_CARD_SHELL.base, QUOTE_CARD_SHELL.interactive)}>
      <div className="flex items-start gap-2">
        {quote.isSpoiler ? <QuoteSpoilerBadge /> : null}
        <QuoteActions bookHref={null} className="ml-auto" maxPage={maxPage} quote={quote} />
      </div>

      <QuoteBody bookHref={null} maxPage={maxPage} quote={quote} />

      <QuoteMeta quote={quote} />

      <QuoteComment text={quote.comment} />
    </article>
  );
}
