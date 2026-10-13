"use client";

import type { Nullable } from "@app/shared";

import { useLayoutEffect, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type TruncatedTextProps = {
  className?: string;
  text: string;
};

export function TruncatedText({ className, text }: TruncatedTextProps) {
  const [textNode, setTextNode] = useState<Nullable<HTMLSpanElement>>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useLayoutEffect(() => {
    if (textNode === null) return;

    const measure = () => setIsTruncated(textNode.scrollWidth > textNode.clientWidth);

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(textNode);

    return () => observer.disconnect();
  }, [textNode, text]);

  const label = (
    <span
      className={cn("min-w-0 truncate", isTruncated && "pointer-events-auto", className)}
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
