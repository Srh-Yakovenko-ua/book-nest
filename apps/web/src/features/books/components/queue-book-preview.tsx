"use client";

import type { BookView } from "@app/shared";
import type { ReactNode } from "react";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useState } from "react";

import { BookCoverFallback } from "@/components/book-cover-fallback";
import { cn } from "@/lib/utils";

type QueueBookPreviewProps = {
  book: BookView;
  children?: ReactNode;
};

export function QueueBookPreview({ book, children }: QueueBookPreviewProps) {
  const t = useTranslations("books");
  const [coverLoaded, setCoverLoaded] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  const coverSrc = book.cover?.urls.card;
  const authorNames = book.authors.map((author) => author.name).join(", ");
  const coverAlt = t("details.coverAlt", { title: book.title });

  return (
    <div className="flex gap-4 rounded-lg border border-border bg-secondary/40 p-3.5">
      <div className="relative aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-md bg-accent shadow-soft">
        {coverSrc === undefined || coverFailed ? (
          <BookCoverFallback alt={coverAlt} className="size-full" seed={book.id} sizes="64px" />
        ) : (
          <Image
            alt={coverAlt}
            className={cn(
              "object-cover transition-opacity duration-500 ease-out",
              coverLoaded ? "opacity-100" : "motion-safe:opacity-0",
            )}
            fill
            onError={() => setCoverFailed(true)}
            onLoad={() => setCoverLoaded(true)}
            sizes="64px"
            src={coverSrc}
            unoptimized
          />
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-heading text-base leading-tight font-semibold text-ink">{book.title}</p>
        {authorNames.length > 0 ? (
          <p className="text-sm text-foreground/80">{authorNames}</p>
        ) : null}
        {children === undefined ? null : (
          <div className="mt-0.5 flex flex-wrap items-center gap-2">{children}</div>
        )}
      </div>
    </div>
  );
}
