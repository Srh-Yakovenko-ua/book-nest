"use client";

import type { TagColor } from "@app/shared";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { tagColorStyle } from "../model/tag-color";

type TagColorDotProps = {
  className?: string;
  color: TagColor;
};

export function TagColorDot({ className, color }: TagColorDotProps) {
  const t = useTranslations("tags.item");
  const tColor = useTranslations("tags.colors");

  return (
    <>
      <span
        aria-hidden
        className={cn("size-7 shrink-0 rounded-full border", className)}
        style={tagColorStyle(color)}
      />
      <span className="sr-only">{t("color", { color: tColor(color) })}</span>
    </>
  );
}
