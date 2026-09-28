"use client";

import type { BookNestPaletteColor } from "@app/shared";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { UiIcon } from "@/components/icons";
import { PALETTE_COLOR_STYLES } from "@/components/ui/palette-color";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type PaletteSwatchButtonProps = Omit<ComponentPropsWithoutRef<"button">, "children" | "color"> & {
  caption?: ReactNode;
  color: BookNestPaletteColor;
  isMuted?: boolean;
  isSelected: boolean;
  tooltip: string;
};

export const PALETTE_SWATCH = {
  grid: "grid grid-cols-4 gap-1",
  item: "flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg px-1 py-2 transition-colors outline-none hover:bg-secondary/60 focus-visible:ring-3 focus-visible:ring-ring/50",
  itemSelected: "bg-secondary/50",
  swatch: "grid size-8 place-items-center rounded-full border",
  swatchSelected: "outline-[1.5px] outline-offset-2 outline-current outline-solid",
} as const;

export function PaletteSwatchButton({
  caption,
  className,
  color,
  isMuted = false,
  isSelected,
  tooltip,
  ...props
}: PaletteSwatchButtonProps) {
  const style = PALETTE_COLOR_STYLES[color];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(PALETTE_SWATCH.item, isSelected && PALETTE_SWATCH.itemSelected, className)}
          data-color={color}
          type="button"
          {...props}
        >
          <span
            aria-hidden
            className={cn(PALETTE_SWATCH.swatch, isSelected && PALETTE_SWATCH.swatchSelected)}
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
