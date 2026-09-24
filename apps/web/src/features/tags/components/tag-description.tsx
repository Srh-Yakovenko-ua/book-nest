"use client";

import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsTextClamped } from "@/hooks/use-is-text-clamped";
import { cn } from "@/lib/utils";

type TagDescriptionProps = {
  className?: string;
  text: string;
};

export function TagDescription({ className, text }: TagDescriptionProps) {
  const { isClamped, ref } = useIsTextClamped<HTMLParagraphElement>(text);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Tooltip onOpenChange={setIsHovered} open={isClamped && isHovered}>
      <TooltipTrigger asChild>
        <p className={cn("min-w-0 text-sm break-words text-muted-foreground", className)} ref={ref}>
          {text}
        </p>
      </TooltipTrigger>
      <TooltipContent className="max-w-80 whitespace-pre-line">{text}</TooltipContent>
    </Tooltip>
  );
}
