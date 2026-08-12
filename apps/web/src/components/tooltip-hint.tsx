"use client";

import type { ComponentProps, ReactElement, ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const TOOLTIP_DELAY_MS = 400;

type TooltipHintProps = {
  children: ReactElement;
  label: ReactNode;
  side?: ComponentProps<typeof TooltipContent>["side"];
};

export function TooltipHint({ children, label, side = "top" }: TooltipHintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
