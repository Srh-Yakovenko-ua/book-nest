"use client";

import type { Nullable } from "@app/shared";
import type { KeyboardEvent, MouseEvent } from "react";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsTextClamped } from "@/hooks/use-is-text-clamped";
import { cn } from "@/lib/utils";

export function BookFieldPreview({ value }: { value: Nullable<string> }) {
  const t = useTranslations("characters.inheritance");
  const text = value ?? t("notSpecified");
  const { isClamped, ref } = useIsTextClamped<HTMLSpanElement>(text);
  const [isRevealed, setIsRevealed] = useState(false);
  const wasRevealedOnPress = useRef(false);

  function revealOnlyWhenClamped(open: boolean) {
    setIsRevealed(open && isClamped);
  }

  function rememberRevealOnPress() {
    wasRevealedOnPress.current = isRevealed;
  }

  function toggleRevealOnClick(event: MouseEvent) {
    if (!isClamped) return;
    event.preventDefault();
    setIsRevealed(!wasRevealedOnPress.current);
    wasRevealedOnPress.current = false;
  }

  function toggleRevealOnKey(event: KeyboardEvent) {
    if (!isClamped || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    setIsRevealed((revealed) => !revealed);
  }

  return (
    <Tooltip onOpenChange={revealOnlyWhenClamped} open={isClamped && isRevealed}>
      <TooltipTrigger asChild>
        <div
          aria-describedby={undefined}
          className={cn(
            "flex h-10 min-w-0 items-center rounded-lg border border-border bg-muted/40 px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
            value === null ? "text-muted-foreground" : "text-foreground",
            isClamped && "cursor-pointer",
          )}
          onClick={toggleRevealOnClick}
          onKeyDown={toggleRevealOnKey}
          onPointerDown={rememberRevealOnPress}
          role={isClamped ? "button" : undefined}
          tabIndex={isClamped ? 0 : undefined}
        >
          <span className="truncate" ref={ref}>
            {text}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-80 break-words">{text}</TooltipContent>
    </Tooltip>
  );
}
