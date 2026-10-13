"use client";

import type { TagColor } from "@app/shared";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

export function TagColorSelection({
  className,
  colors,
}: {
  className?: string;
  colors: readonly TagColor[];
}) {
  const t = useTranslations("tags.colorPalette");
  const tColor = useTranslations("tags.colors");

  return (
    <p
      className={cn(
        "text-sm",
        colors.length === 0 ? "text-muted-foreground" : "text-foreground",
        className,
      )}
    >
      {colors.length === 0
        ? t("none")
        : t("selected", { colors: colors.map((color) => tColor(color)).join(", ") })}
    </p>
  );
}
