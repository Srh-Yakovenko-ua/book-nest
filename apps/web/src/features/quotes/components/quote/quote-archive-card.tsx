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

type QuoteArchiveCardLayoutSpec = {
  fitsBodyToCard: boolean;
  shell: string;
  showsBook: boolean;
};

const QUOTE_ARCHIVE_CARD_LAYOUT = {
  archive: {
    fitsBodyToCard: true,
    shell: cn(QUOTE_CARD_SHELL.base, QUOTE_CARD_SHELL.interactive, QUOTE_CARD_SHELL.fixedHeight),
    showsBook: true,
  },
  embedded: {
    fitsBodyToCard: false,
    shell: cn(QUOTE_CARD_SHELL.base, QUOTE_CARD_SHELL.interactive),
    showsBook: false,
  },
} as const satisfies Record<string, QuoteArchiveCardLayoutSpec>;

type QuoteArchiveCardProps = {
  layout?: keyof typeof QUOTE_ARCHIVE_CARD_LAYOUT;
  quote: QuoteView;
};

export function QuoteArchiveCard({ layout = "archive", quote }: QuoteArchiveCardProps) {
  const t = useTranslations("quotes.card");
  const { fitsBodyToCard, shell, showsBook } = QUOTE_ARCHIVE_CARD_LAYOUT[layout];
  const bookHref = showsBook ? `/books/${quote.bookId}` : null;
  const fullView = useQuoteFullView();
  const [card, setCard] = useState<Nullable<HTMLElement>>(null);

  return (
    <article className={shell} ref={setCard}>
      <div className="flex shrink-0 items-start gap-2">
        {showsBook ? <QuoteBookHeader book={quote.book} /> : null}
        <QuoteActions className="ml-auto" quote={quote} />
      </div>

      <QuoteBody fitTo={fitsBodyToCard ? card : null} onExpand={fullView.openFrom} quote={quote} />

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
