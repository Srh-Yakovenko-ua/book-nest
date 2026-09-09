"use client";

import type { Nullable, QuoteView } from "@app/shared";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { UiIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

import { QuoteFullViewDialog } from "./quote-full-view-dialog";
import { QuotePreview } from "./quote-preview";
import { QuoteSpoilerGate } from "./quote-spoiler-gate";

type QuoteBodyProps = {
  bookHref: Nullable<string>;
  maxPage?: number;
  quote: QuoteView;
};

export function QuoteBody({ bookHref, maxPage, quote }: QuoteBodyProps) {
  const t = useTranslations("quotes.card");
  const tSpoiler = useTranslations("quotes.spoiler");
  const triggerRef = useRef<Nullable<HTMLButtonElement>>(null);
  const [isFullViewOpen, setFullViewOpen] = useState(false);

  return (
    <>
      {quote.isSpoiler ? (
        <QuoteSpoilerGate
          action={
            <Button
              className="h-11 sm:h-8"
              onClick={() => setFullViewOpen(true)}
              ref={triggerRef}
              size="sm"
              variant="secondary"
            >
              <UiIcon name="eye" size={14} />
              {tSpoiler("showQuote")}
            </Button>
          }
        />
      ) : (
        <QuotePreview
          expandAction={
            <Button
              className="h-auto p-0"
              onClick={() => setFullViewOpen(true)}
              ref={triggerRef}
              size="sm"
              variant="link"
            >
              {t("showFull")}
            </Button>
          }
          text={quote.text}
        />
      )}

      <QuoteFullViewDialog
        bookHref={bookHref}
        maxPage={maxPage}
        onOpenChange={setFullViewOpen}
        open={isFullViewOpen}
        quote={quote}
        triggerRef={triggerRef}
      />
    </>
  );
}
