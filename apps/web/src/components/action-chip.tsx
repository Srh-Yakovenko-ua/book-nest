"use client";

import type { ComponentProps, ReactNode } from "react";

import { TooltipHint } from "@/components/tooltip-hint";
import { cn } from "@/lib/utils";

type ActionChipButtonProps = ComponentProps<"button"> & {
  highlighted?: boolean;
};

type ActionChipProps = {
  actions: ReactNode;
  active?: boolean;
  invalid?: boolean;
  label: string;
  secondaryLabel?: string;
  spoiler?: boolean;
};

export function ActionChip({
  actions,
  active = false,
  invalid = false,
  label,
  secondaryLabel,
  spoiler = false,
}: ActionChipProps) {
  return (
    <span
      className={cn(
        "inline-flex min-h-10 max-w-full items-center rounded-xl border text-sm transition-[border-color,box-shadow,background-color]",
        spoiler
          ? "border-dashed border-border bg-secondary/50 text-muted-foreground"
          : "border-accent-border bg-accent text-accent-foreground",
        active && "border-primary ring-2 ring-primary/25",
        invalid && "border-destructive",
      )}
      data-active={active ? "" : undefined}
      data-spoiler={spoiler ? "" : undefined}
    >
      <TooltipHint label={label}>
        <span className="flex min-w-0 flex-col py-1 pr-2 pl-3 sm:flex-row sm:items-baseline sm:gap-1.5">
          <span className="leading-snug font-semibold break-words max-sm:line-clamp-2 sm:max-w-60 sm:truncate">
            {label}
          </span>
          {secondaryLabel === undefined ? null : (
            <span className="shrink-0 text-xs leading-snug font-medium opacity-75">
              {secondaryLabel}
            </span>
          )}
        </span>
      </TooltipHint>
      <span aria-hidden className="h-5 w-px shrink-0 bg-current opacity-20" />
      <span className="flex shrink-0 items-center gap-0.5 px-1">{actions}</span>
    </span>
  );
}

export function ActionChipButton({
  className,
  highlighted = false,
  ...props
}: ActionChipButtonProps) {
  return (
    <button
      className={cn(
        "grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg text-current opacity-80 transition-[opacity,background-color,color] outline-none hover:bg-current/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring aria-pressed:text-primary aria-pressed:opacity-100 sm:size-8",
        highlighted && "bg-primary/10 text-primary opacity-100",
        className,
      )}
      type="button"
      {...props}
    />
  );
}
