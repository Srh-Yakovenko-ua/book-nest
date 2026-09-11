"use client";

import type { Nullable, QuoteView } from "@app/shared";

import { useLocale, useTranslations } from "next-intl";
import { Fragment, useEffect, useRef } from "react";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/format";

import { useQuotesOverview } from "../api/use-quotes-overview";
import { useRecordRediscoveryImpression } from "../api/use-quotes-overview-mutations";
import { useQuoteFullView } from "../hooks/use-quote-full-view";
import { QuoteBookHeader } from "./quote/quote-book-header";
import { QuoteFullViewDialog } from "./quote/quote-full-view-dialog";
import { QuoteMeta } from "./quote/quote-meta";

type QuoteRediscoveryBlockProps = {
  isVisible: boolean;
  onOpenFullView?: (quote: QuoteView) => void;
};

const REDISCOVERY_SIGNAL_ICONS = {
  comment: "note",
  favorite: "heart",
} as const satisfies Record<string, UiIconName>;

export function QuoteRediscoveryBlock({ isVisible, onOpenFullView }: QuoteRediscoveryBlockProps) {
  const { data } = useQuotesOverview();

  const memoryQuote = data?.memoryQuote ?? null;
  const quote = memoryQuote === null || memoryQuote.isSpoiler ? null : memoryQuote;

  useRediscoveryImpression({ isVisible, quoteId: quote?.id ?? null });

  if (quote === null) return null;

  if (onOpenFullView === undefined) return <RediscoveryCardWithDialog quote={quote} />;

  return <RediscoveryCard onOpenFullView={() => onOpenFullView(quote)} quote={quote} />;
}

function RediscoveryCard({
  onOpenFullView,
  quote,
}: {
  onOpenFullView: (trigger: HTMLButtonElement) => void;
  quote: QuoteView;
}) {
  const t = useTranslations("quotes.sidebar.rediscovery");
  const locale = useLocale();

  const hasComment = (quote.comment ?? "").trim().length > 0;
  const signals = [
    quote.isFavorite ? { icon: REDISCOVERY_SIGNAL_ICONS.favorite, label: t("favorite") } : null,
    hasComment ? { icon: REDISCOVERY_SIGNAL_ICONS.comment, label: t("withComment") } : null,
  ].filter((signal) => signal !== null);

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <h2 className="flex items-center gap-1.5 font-heading text-sm font-semibold text-ink">
        <UiIcon className="text-primary" name="sparkles" size={16} />
        {t("title")}
      </h2>

      <QuoteBookHeader book={quote.book} />

      <blockquote className="line-clamp-4 font-heading text-sm leading-relaxed break-words whitespace-pre-line text-ink">
        {quote.text}
      </blockquote>

      <QuoteMeta quote={quote} />

      {signals.length === 0 ? null : (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {signals.map((signal, index) => (
            <Fragment key={signal.label}>
              {index === 0 ? null : <span aria-hidden="true">·</span>}
              <span className="flex items-center gap-1">
                <UiIcon className="text-icon" name={signal.icon} size={13} />
                {signal.label}
              </span>
            </Fragment>
          ))}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {t("savedAge", { age: formatRelativeTime(quote.createdAt, locale) })}
      </p>

      <Button
        className="justify-between"
        onClick={(event) => onOpenFullView(event.currentTarget)}
        variant="secondary"
      >
        {t("cta")}
        <UiIcon name="chevron-right" size={16} />
      </Button>
    </section>
  );
}

function RediscoveryCardWithDialog({ quote }: { quote: QuoteView }) {
  const fullView = useQuoteFullView();

  return (
    <>
      <RediscoveryCard onOpenFullView={fullView.openFrom} quote={quote} />

      <QuoteFullViewDialog
        bookHref={`/books/${quote.bookId}`}
        onOpenChange={fullView.onOpenChange}
        open={fullView.isOpen}
        quote={quote}
        triggerRef={fullView.triggerRef}
      />
    </>
  );
}

function useRediscoveryImpression({
  isVisible,
  quoteId,
}: {
  isVisible: boolean;
  quoteId: Nullable<string>;
}) {
  const { mutate } = useRecordRediscoveryImpression();
  const recordedQuoteIds = useRef(new Set<string>());

  useEffect(() => {
    if (!isVisible || quoteId === null) return;
    if (recordedQuoteIds.current.has(quoteId)) return;

    recordedQuoteIds.current.add(quoteId);
    mutate({ quoteId });
  }, [isVisible, mutate, quoteId]);
}
