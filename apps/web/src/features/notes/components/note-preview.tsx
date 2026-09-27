"use client";

import type { Nullable } from "@app/shared";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { useFittedLineClamp } from "@/hooks/use-fitted-line-clamp";
import { cn } from "@/lib/utils";

import type { NoteCardLayout } from "./note-card-layout";

import { NOTE_CARD_LAYOUT } from "./note-card-layout";

type NotePreviewProps = {
  card: Nullable<HTMLElement>;
  layout: NoteCardLayout;
  onExpand: (trigger: HTMLButtonElement) => void;
  text: string;
};

export function NotePreview({ card, layout, onExpand, text }: NotePreviewProps) {
  const t = useTranslations("notes.card");
  const { fitsPreviewToCard, preview } = NOTE_CARD_LAYOUT[layout];
  const { isClamped, lines, ref } = useFittedLineClamp<HTMLParagraphElement>(
    text,
    fitsPreviewToCard ? card : null,
  );

  return (
    <div className="flex min-w-0 flex-col items-start gap-1.5">
      <p
        className={cn(
          "w-full text-sm leading-relaxed wrap-anywhere whitespace-pre-line text-foreground",
          preview,
        )}
        ref={ref}
        style={fitsPreviewToCard ? { WebkitLineClamp: lines } : undefined}
      >
        {text}
      </p>
      {isClamped ? (
        <Button
          className="h-auto p-0"
          onClick={(event) => onExpand(event.currentTarget)}
          size="sm"
          variant="link"
        >
          {t("showFull")}
        </Button>
      ) : null}
    </div>
  );
}
