"use client";

import type { ReactNode } from "react";

import { useIsTextClamped } from "../../hooks/use-is-text-clamped";

type QuotePreviewProps = {
  expandAction: ReactNode;
  text: string;
};

export function QuotePreview({ expandAction, text }: QuotePreviewProps) {
  const { isClamped, ref } = useIsTextClamped<HTMLQuoteElement>(text);

  return (
    <div className="flex flex-col items-start gap-1.5">
      <blockquote
        className="line-clamp-5 font-heading text-base leading-relaxed break-words whitespace-pre-line text-ink"
        ref={ref}
      >
        {text}
      </blockquote>
      {isClamped ? expandAction : null}
    </div>
  );
}
