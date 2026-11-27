"use client";

import type { Nullable } from "@app/shared";

import Image from "next/image";

import { BookCoverFallback } from "@/components/book-cover-fallback";
import { cn } from "@/lib/utils";

const COVER = {
  height: 96,
  placeholderSizes: { icon: "4rem", titled: "(min-width: 640px) 8rem, 7rem" },
  width: 64,
} as const;

export function StatisticsBookCover({
  bookId,
  className,
  coverThumbUrl,
  placeholder = "icon",
  title,
}: {
  bookId: string;
  className?: string;
  coverThumbUrl: Nullable<string>;
  placeholder?: "icon" | "titled";
  title: string;
}) {
  if (coverThumbUrl === null) {
    return (
      <BookCoverFallback
        alt={title}
        className={cn("aspect-2/3 w-full rounded-md", className)}
        seed={bookId}
        sizes={COVER.placeholderSizes[placeholder]}
        title={placeholder === "titled" ? title : undefined}
      />
    );
  }

  return (
    <Image
      alt={title}
      className={cn("aspect-[2/3] w-full rounded-md object-cover", className)}
      height={COVER.height}
      src={coverThumbUrl}
      unoptimized
      width={COVER.width}
    />
  );
}
