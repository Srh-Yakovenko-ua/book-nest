"use client";

import type { BookView } from "@app/shared";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { useId, useState } from "react";

import { useAnimatedHeight } from "@/hooks/use-animated-height";
import { cn } from "@/lib/utils";

import { FormSection } from "./form-section";

type BookDetailsAboutProps = {
  book: BookView;
};

const COLLAPSED_LINES = 7;

export function BookDetailsAbout({ book }: BookDetailsAboutProps) {
  const t = useTranslations("books");
  const description = book.description?.trim() ?? "";

  const descriptionId = useId();
  const [expanded, setExpanded] = useState(false);
  const {
    containerRef,
    contentRef,
    isClamped: overflowing,
  } = useAnimatedHeight<HTMLParagraphElement>({
    collapsedHeight: collapsedDescriptionHeight,
    contentKey: description,
    expanded,
  });

  return (
    <FormSection
      icon="note"
      title={
        <span className="relative inline-flex items-center">
          {t("details.about.title")}
          <Image
            alt=""
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 select-none"
            height={40}
            src="/illustrations/leaf-1.png"
            unoptimized
            width={48}
          />
        </span>
      }
    >
      {description.length === 0 ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{t("details.about.empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="relative">
            <div
              className="overflow-hidden motion-safe:transition-[height] motion-safe:duration-300 motion-safe:ease-out"
              ref={containerRef}
            >
              <p
                className="text-sm leading-relaxed whitespace-pre-line text-foreground/90"
                id={descriptionId}
                ref={contentRef}
              >
                {description}
              </p>
            </div>
            {!expanded && overflowing ? (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent"
              />
            ) : null}
          </div>
          {overflowing ? (
            <button
              aria-controls={descriptionId}
              aria-expanded={expanded}
              className="inline-flex cursor-pointer items-center gap-1 self-start text-sm font-medium text-primary hover:text-primary/80"
              onClick={() => setExpanded((value) => !value)}
              type="button"
            >
              {expanded ? t("details.about.showLess") : t("details.about.showMore")}
              <ChevronDown
                aria-hidden
                className={cn("size-4 transition-transform", expanded && "rotate-180")}
              />
            </button>
          ) : null}
        </div>
      )}
    </FormSection>
  );
}

function collapsedDescriptionHeight(content: HTMLParagraphElement): number {
  const lineHeight = Number.parseFloat(getComputedStyle(content).lineHeight);
  if (Number.isNaN(lineHeight)) return content.scrollHeight;
  return Math.round(lineHeight * COLLAPSED_LINES);
}
