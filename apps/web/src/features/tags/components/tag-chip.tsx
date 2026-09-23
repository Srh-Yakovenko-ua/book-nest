"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

import type { TagCardItem } from "../model/tags-derive";

import { tagLibraryHref } from "../model/library-links";
import { tagColorStyle } from "../model/tag-color";

type TagChipProps = {
  className?: string;
  tag: TagCardItem;
};

export function TagChip({ className, tag }: TagChipProps) {
  const t = useTranslations("genresTags.tags");

  return (
    <Link
      aria-label={t("chipLabel", { count: tag.booksCount, name: tag.name })}
      className={cn(
        "inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
        "transition-[transform,box-shadow] duration-150 outline-none",
        "hover:-translate-y-0.5 hover:shadow-hover focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
      href={tagLibraryHref(tag.id)}
      style={tagColorStyle(tag.color)}
    >
      <span className="truncate">{tag.name}</span>
      <span
        aria-hidden
        className="shrink-0 rounded-full bg-current/12 px-1.5 py-0.5 text-xs tabular-nums"
      >
        {tag.booksCount}
      </span>
    </Link>
  );
}
