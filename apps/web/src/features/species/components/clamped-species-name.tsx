"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ClampedSpeciesNameProps = {
  className?: string;
  name: string;
};

export function ClampedSpeciesName({ className, name }: ClampedSpeciesNameProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("line-clamp-2 min-w-0 wrap-anywhere", className)}>{name}</span>
      </TooltipTrigger>
      <TooltipContent className="wrap-anywhere">{name}</TooltipContent>
    </Tooltip>
  );
}
