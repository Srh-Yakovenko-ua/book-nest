"use client";

import type { QuoteView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRecordImpressionWhenVisible } from "@/features/notes";
import { QuoteFullViewDialog, useQuoteFullView, useUpdateQuote } from "@/features/quotes";

import { useQuoteMemoryImpressions } from "../hooks/use-quote-memory-impressions";
import { homeBookHref } from "../model/home-library-links";
import { HomeMemoryBookLine, HomeMemoryFooter } from "./home-memory-details";
import { HomeMemoryFavoriteToggle } from "./home-memory-favorite-toggle";
import { HomeMemoryFrame } from "./home-memory-frame";
import { HomeMemorySpoiler } from "./home-memory-spoiler";

export function HomeMemoryQuote({ quote }: { quote: QuoteView }) {
  const tFavorite = useTranslations("quotes.favorite");
  const [isRevealed, setRevealed] = useState(false);
  const updateQuote = useUpdateQuote();
  const fullView = useQuoteFullView();
  const recordImpression = useQuoteMemoryImpressions();
  const isHidden = quote.isSpoiler && !isRevealed;

  function toggleFavorite() {
    if (updateQuote.isPending) return;
    updateQuote.mutate(
      { bookId: quote.bookId, input: { isFavorite: !quote.isFavorite }, quoteId: quote.id },
      {
        onError: () => toast.error(tFavorite("error")),
        onSuccess: (updated) =>
          toast.success(updated.isFavorite ? tFavorite("added") : tFavorite("removed")),
      },
    );
  }

  return (
    <HomeMemoryFrame
      action={
        isHidden ? null : (
          <HomeMemoryFavoriteToggle
            isFavorite={quote.isFavorite}
            isPending={updateQuote.isPending}
            onToggle={toggleFavorite}
          />
        )
      }
    >
      {isHidden ? (
        <HomeMemorySpoiler onReveal={() => setRevealed(true)} />
      ) : (
        <QuoteMemoryText quote={quote} recordImpression={recordImpression} />
      )}

      <HomeMemoryBookLine
        authors={quote.book.firstAuthorName}
        bookId={quote.bookId}
        bookTitle={quote.book.title}
        chapter={isHidden ? null : quote.chapter}
        page={isHidden ? null : quote.page}
      />

      <HomeMemoryFooter
        createdAt={quote.createdAt}
        onOpenFull={isHidden ? null : fullView.openFrom}
      />

      <QuoteFullViewDialog
        bookHref={homeBookHref(quote.bookId)}
        onOpenChange={fullView.onOpenChange}
        open={fullView.isOpen}
        quote={quote}
        triggerRef={fullView.triggerRef}
      />
    </HomeMemoryFrame>
  );
}

function QuoteMemoryText({
  quote,
  recordImpression,
}: {
  quote: QuoteView;
  recordImpression: (quoteId: string) => void;
}) {
  const t = useTranslations("home.memory");
  const textRef = useRecordImpressionWhenVisible<HTMLQuoteElement>({
    impressionKey: quote.id,
    recordImpression,
  });

  return (
    <blockquote
      className="line-clamp-4 border-l-2 border-primary/40 pl-3 font-heading text-base leading-relaxed wrap-anywhere whitespace-pre-line text-ink italic"
      ref={textRef}
    >
      {t("quoteText", { text: quote.text })}
    </blockquote>
  );
}
