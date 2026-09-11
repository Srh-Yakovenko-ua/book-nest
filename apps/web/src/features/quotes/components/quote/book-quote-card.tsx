"use client";

import type { QuoteView } from "@app/shared";

import { cn } from "@/lib/utils";

import { useQuoteFullView } from "../../hooks/use-quote-full-view";
import { QuoteActions } from "./quote-actions";
import { QuoteBody } from "./quote-body";
import { QUOTE_CARD_SHELL } from "./quote-card-shell";
import { QuoteComment } from "./quote-comment";
import { QuoteFullViewDialog } from "./quote-full-view-dialog";
import { QuoteMeta } from "./quote-meta";
import { QuoteSpoilerBadge } from "./quote-spoiler-badge";

type BookQuoteCardProps = {
  maxPage?: number;
  quote: QuoteView;
};

export function BookQuoteCard({ maxPage, quote }: BookQuoteCardProps) {
  const fullView = useQuoteFullView();

  return (
    <article className={cn(QUOTE_CARD_SHELL.base, QUOTE_CARD_SHELL.interactive)}>
      <div className="flex items-start gap-2">
        {quote.isSpoiler ? <QuoteSpoilerBadge /> : null}
        <QuoteActions bookHref={null} className="ml-auto" maxPage={maxPage} quote={quote} />
      </div>

      <QuoteBody onExpand={fullView.openFrom} quote={quote} />

      <QuoteMeta quote={quote} />

      <QuoteComment text={quote.comment} />

      <QuoteFullViewDialog
        bookHref={null}
        onOpenChange={fullView.onOpenChange}
        open={fullView.isOpen}
        quote={quote}
        triggerRef={fullView.triggerRef}
      />
    </article>
  );
}
