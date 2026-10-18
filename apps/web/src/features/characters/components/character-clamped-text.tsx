"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { useAnimatedHeight } from "@/hooks/use-animated-height";
import { cn } from "@/lib/utils";

type CharacterClampedTextProps = {
  collapsedLines?: number;
  defaultExpanded?: boolean;
  fadeClassName?: string;
  text: string;
};

const DEFAULT_COLLAPSED_LINES = 7;

export function CharacterClampedText({
  collapsedLines = DEFAULT_COLLAPSED_LINES,
  defaultExpanded = false,
  fadeClassName = "from-card",
  text,
}: CharacterClampedTextProps) {
  const t = useTranslations("characters.page");
  const textId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { containerRef, contentRef, isClamped } = useAnimatedHeight<HTMLParagraphElement>({
    collapsedHeight: collapsedTextHeight,
    contentKey: `${collapsedLines}:${text}`,
    expanded,
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <div
          className="overflow-hidden motion-safe:transition-[height] motion-safe:duration-300 motion-safe:ease-out"
          ref={containerRef}
        >
          <p
            className="text-sm leading-relaxed whitespace-pre-line text-foreground/90"
            data-collapsed-lines={collapsedLines}
            id={textId}
            ref={contentRef}
          >
            {text}
          </p>
        </div>
        {!expanded && isClamped ? (
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t to-transparent",
              fadeClassName,
            )}
          />
        ) : null}
      </div>
      {isClamped ? (
        <button
          aria-controls={textId}
          aria-expanded={expanded}
          className="inline-flex cursor-pointer items-center gap-1 self-start text-sm font-medium text-primary hover:text-primary/80"
          onClick={() => setExpanded((value) => !value)}
          type="button"
        >
          {expanded ? t("showLess") : t("showMore")}
          <ChevronDown
            aria-hidden
            className={cn("size-4 transition-transform", expanded && "rotate-180")}
          />
        </button>
      ) : null}
    </div>
  );
}

function collapsedTextHeight(content: HTMLParagraphElement): number {
  const lineHeight = Number.parseFloat(getComputedStyle(content).lineHeight);
  const lines = Number(content.dataset.collapsedLines);
  if (Number.isNaN(lineHeight) || Number.isNaN(lines)) return content.scrollHeight;
  return Math.round(lineHeight * lines);
}
