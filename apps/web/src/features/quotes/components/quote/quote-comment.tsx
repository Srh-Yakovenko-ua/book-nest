"use client";

import type { Nullable } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

import { useIsTextClamped } from "../../hooks/use-is-text-clamped";

type QuoteCommentProps = {
  expandAction?: ReactNode;
  isCompact?: boolean;
  text: Nullable<string>;
};

export function QuoteComment({ expandAction, isCompact = false, text }: QuoteCommentProps) {
  const t = useTranslations("quotes.card");
  const { isClamped, ref } = useIsTextClamped<HTMLParagraphElement>(text ?? "");

  if (text === null) return null;

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 rounded-md border border-border/60 bg-secondary/30 px-3 py-2",
        isCompact && "md:shrink-0",
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <UiIcon className="shrink-0 text-icon" name="note" size={13} />
        {t("commentLabel")}
      </p>
      <p
        className={cn(
          "text-sm leading-relaxed break-words whitespace-pre-line text-muted-foreground",
          isCompact && "md:line-clamp-2",
        )}
        ref={ref}
      >
        {text}
      </p>
      {isClamped ? expandAction : null}
    </div>
  );
}
