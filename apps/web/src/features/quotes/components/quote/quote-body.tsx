"use client";

import type { Nullable, QuoteView } from "@app/shared";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { QuotePreview } from "./quote-preview";
import { QuoteSpoilerGate } from "./quote-spoiler-gate";

type QuoteBodyProps = {
  fitTo?: Nullable<HTMLElement>;
  onExpand: (trigger: HTMLButtonElement) => void;
  quote: QuoteView;
};

export function QuoteBody({ fitTo, onExpand, quote }: QuoteBodyProps) {
  const t = useTranslations("quotes.card");
  const tSpoiler = useTranslations("quotes.spoiler");

  if (quote.isSpoiler) {
    return (
      <QuoteSpoilerGate
        action={
          <Button
            className="h-11 sm:h-8"
            onClick={(event) => onExpand(event.currentTarget)}
            size="sm"
          >
            {tSpoiler("showQuote")}
          </Button>
        }
      />
    );
  }

  return (
    <QuotePreview
      expandAction={
        <Button
          className="h-auto p-0"
          onClick={(event) => onExpand(event.currentTarget)}
          size="sm"
          variant="link"
        >
          {t("showFull")}
        </Button>
      }
      fitTo={fitTo}
      text={quote.text}
    />
  );
}
