"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useFittedLineClamp } from "../../hooks/use-fitted-line-clamp";

type QuotePreviewProps = {
  expandAction: ReactNode;
  fitTo?: Nullable<HTMLElement>;
  text: string;
};

export function QuotePreview({ expandAction, fitTo, text }: QuotePreviewProps) {
  const { isClamped, lines, ref } = useFittedLineClamp<HTMLQuoteElement>(text, fitTo);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <blockquote
        className="line-clamp-5 font-heading text-base leading-relaxed break-words whitespace-pre-line text-ink"
        ref={ref}
        style={{ WebkitLineClamp: lines }}
      >
        {text}
      </blockquote>
      {isClamped ? expandAction : null}
    </div>
  );
}
