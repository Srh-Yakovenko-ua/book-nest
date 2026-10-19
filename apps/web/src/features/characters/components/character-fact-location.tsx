"use client";

import type { CharacterFactView } from "@app/shared";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { TruncatedText } from "@/components/truncated-text";
import { cn } from "@/lib/utils";

type CharacterFactLocationProps = Pick<CharacterFactView, "chapter" | "page"> & {
  className?: string;
};

export function CharacterFactLocation({ chapter, className, page }: CharacterFactLocationProps) {
  const t = useTranslations("characters.facts");

  if (chapter === null && page === null) return null;

  return (
    <p className={cn("flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", className)}>
      <UiIcon className="shrink-0 text-icon" name="book" size={13} />
      {chapter === null ? null : <TruncatedText text={chapter} />}
      {chapter === null || page === null ? null : <span aria-hidden>·</span>}
      {page === null ? null : (
        <span className="shrink-0 whitespace-nowrap tabular-nums">{t("page", { page })}</span>
      )}
    </p>
  );
}
