"use client";

import type { Nullable, QuoteView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useQuoteFullView } from "../../hooks/use-quote-full-view";
import { QuoteActions } from "./quote-actions";
import { QuoteBody } from "./quote-body";
import { QuoteBookHeader } from "./quote-book-header";
import { QUOTE_CARD_SHELL } from "./quote-card-shell";
import { QuoteComment } from "./quote-comment";
import { QuoteFullViewDialog } from "./quote-full-view-dialog";
import { QuoteMeta } from "./quote-meta";

export function QuoteArchiveCard({ quote }: { quote: QuoteView }) {
  const t = useTranslations("quotes.card");
  const bookHref = `/books/${quote.bookId}`;
  const fullView = useQuoteFullView();
  const [card, setCard] = useState<Nullable<HTMLElement>>(null);

  return (
    <article
      className={cn(
        QUOTE_CARD_SHELL.base,
        QUOTE_CARD_SHELL.interactive,
        QUOTE_CARD_SHELL.fixedHeight,
      )}
      ref={setCard}
    >
      <div className="flex shrink-0 items-start gap-2">
        <QuoteBookHeader book={quote.book} />
        <QuoteActions bookHref={bookHref} className="ml-auto" quote={quote} />
      </div>

      <QuoteBody fitTo={card} onExpand={fullView.openFrom} quote={quote} />

      <QuoteMeta isCompact quote={quote} />

      <QuoteComment
        expandAction={
          <Button
            className="h-auto p-0"
            onClick={(event) => fullView.openFrom(event.currentTarget)}
            size="sm"
            variant="link"
          >
            {t("showFullComment")}
          </Button>
        }
        isCompact
        text={quote.comment}
      />

      <QuoteFullViewDialog
        bookHref={bookHref}
        onOpenChange={fullView.onOpenChange}
        open={fullView.isOpen}
        quote={quote}
        triggerRef={fullView.triggerRef}
      />
    </article>
  );
}
