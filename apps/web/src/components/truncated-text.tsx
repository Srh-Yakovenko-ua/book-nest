"use client";

import type { Nullable } from "@app/shared";

import { useLayoutEffect, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isTextClamped } from "@/hooks/use-is-text-clamped";
import { cn } from "@/lib/utils";

const LINE_CLAMP = {
  1: "truncate",
  2: "line-clamp-2",
} as const;

type TruncatedTextProps = {
  className?: string;
  lines?: keyof typeof LINE_CLAMP;
  text: string;
};

export function TruncatedText({ className, lines = 1, text }: TruncatedTextProps) {
  const [textNode, setTextNode] = useState<Nullable<HTMLSpanElement>>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    if (textNode === null) return;

    const measure = () => setIsTruncated(isTextClamped(textNode));

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(textNode);

    return () => observer.disconnect();
  }, [textNode, text, lines]);

  const label = (
    <span
      className={cn("min-w-0", LINE_CLAMP[lines], isTruncated && "pointer-events-auto", className)}
      ref={setTextNode}
    >
      {text}
    </span>
  );

  if (!isTruncated) return label;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
