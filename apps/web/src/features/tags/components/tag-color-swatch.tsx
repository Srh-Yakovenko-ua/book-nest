"use client";

import type { TagColor } from "@app/shared";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { useTranslations } from "next-intl";

import { UiIcon } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { TAG_COLOR_STYLES } from "../model/tag-color";

type TagColorSwatchButtonProps = Omit<ComponentPropsWithoutRef<"button">, "children" | "color"> & {
  caption?: ReactNode;
  color: TagColor;
  isMuted?: boolean;
  isSelected: boolean;
  tooltip: string;
};

export const TAG_COLOR_SWATCH = {
  grid: "grid grid-cols-4 gap-1",
  item: "flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg px-1 py-2 transition-colors outline-none hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50",
  itemSelected: "bg-secondary/50",
  swatch: "grid size-8 place-items-center rounded-full border",
  swatchSelected: "outline-[1.5px] outline-offset-2 outline-current outline-solid",
} as const;

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

export function TagColorSwatchButton({
  caption,
  className,
  color,
  isMuted = false,
  isSelected,
  tooltip,
  ...props
}: TagColorSwatchButtonProps) {
  const style = TAG_COLOR_STYLES[color];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            TAG_COLOR_SWATCH.item,
            isSelected && TAG_COLOR_SWATCH.itemSelected,
            className,
          )}
          data-color={color}
          type="button"
          {...props}
        >
          <span
            aria-hidden
            className={cn(TAG_COLOR_SWATCH.swatch, isSelected && TAG_COLOR_SWATCH.swatchSelected)}
            data-selected={isSelected}
            style={{
              backgroundColor: style.bg,
              borderColor: isMuted ? "var(--border)" : style.border,
              color: style.text,
            }}
          >
            {isSelected ? <UiIcon name="check" size={16} /> : null}
          </span>
          {caption}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
