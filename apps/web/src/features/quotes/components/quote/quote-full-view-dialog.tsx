"use client";

import type { Nullable, QuoteView } from "@app/shared";
import type { RefObject } from "react";

import { useTranslations } from "next-intl";
import { useRef } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/i18n/navigation";

import { QuoteComment } from "./quote-comment";
import { QuoteCover } from "./quote-cover";
import { QuoteMeta } from "./quote-meta";
import { QuoteSpoilerBadge } from "./quote-spoiler-badge";

type QuoteFullViewDialogProps = {
  bookHref: Nullable<string>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  quote: QuoteView;
  triggerRef?: RefObject<Nullable<HTMLButtonElement>>;
};

export function QuoteFullViewDialog({
  bookHref,
  onOpenChange,
  open,
  quote,
  triggerRef,
}: QuoteFullViewDialogProps) {
  const t = useTranslations("quotes.card");
  const contentRef = useRef<HTMLDivElement>(null);

  const authorName =
    quote.book.firstAuthorName.length === 0 ? t("unknownAuthor") : quote.book.firstAuthorName;

  const cover = (
    <QuoteCover
      alt={t("coverAlt", { title: quote.book.title })}
      className="aspect-[3/4] w-16 shrink-0"
      iconSize={22}
      sizes="64px"
      src={quote.book.cover?.urls.thumb ?? null}
    />
  );

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[90dvh] gap-4 overflow-y-auto sm:max-w-2xl"
        onCloseAutoFocus={(event) => {
          const trigger = triggerRef?.current ?? null;
          if (trigger === null || !trigger.isConnected) return;
          event.preventDefault();
          trigger.focus();
        }}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => contentRef.current?.focus());
        }}
        ref={contentRef}
        tabIndex={-1}
      >
        <DialogHeader className="flex-row items-start gap-4 space-y-0 pr-8 text-left">
          {bookHref === null ? (
            <div className="shrink-0">{cover}</div>
          ) : (
            <Link
              className="shrink-0 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              href={bookHref}
              tabIndex={-1}
            >
              {cover}
            </Link>
          )}
          <div className="flex min-w-0 flex-col gap-1.5">
            <DialogTitle className="font-heading text-lg leading-snug text-ink">
              {bookHref === null ? (
                quote.book.title
              ) : (
                <Link
                  className="rounded-sm transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
                  href={bookHref}
                >
                  {quote.book.title}
                </Link>
              )}
            </DialogTitle>
            <DialogDescription>{authorName}</DialogDescription>
          </div>
        </DialogHeader>

        <blockquote
          aria-label={t("quoteTextLabel")}
          className="max-h-[45vh] overflow-y-auto rounded-lg border border-l-2 border-border border-l-primary/70 bg-secondary/40 p-4 font-heading text-base leading-relaxed break-words whitespace-pre-line text-ink outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-lg"
          role="region"
          tabIndex={0}
        >
          {quote.text}
        </blockquote>

        <QuoteMeta quote={quote} trailing={quote.isSpoiler ? <QuoteSpoilerBadge /> : undefined} />

        <QuoteComment text={quote.comment} />
      </DialogContent>
    </Dialog>
  );
}
