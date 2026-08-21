"use client";

import type { LoanBookPreview } from "@app/shared";
import type { ReactNode } from "react";

import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";

type LoanContactPreviewRowProps = {
  book: LoanBookPreview;
  meta: ReactNode;
};

export function LoanContactPreviewRow({ book, meta }: LoanContactPreviewRowProps) {
  const bookHref = `/books/${book.id}`;

  return (
    <li className="flex items-center gap-2.5">
      <Link
        className="relative aspect-[3/4] w-9 shrink-0 overflow-hidden rounded-sm bg-accent outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        href={bookHref}
        tabIndex={-1}
      >
        {book.cover === null ? (
          <span className="grid h-full w-full place-items-center text-accent-foreground/70">
            <UiIcon name="book" size={14} />
          </span>
        ) : (
          <Image
            alt={book.title}
            className="object-cover"
            fill
            sizes="36px"
            src={book.cover.urls.thumb}
            unoptimized
          />
        )}
      </Link>

      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          className="truncate text-sm font-medium text-ink no-underline transition-colors outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          href={bookHref}
        >
          {book.title}
        </Link>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {meta}
        </span>
      </span>
    </li>
  );
}

export function LoanContactPreviewSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: rows }, (_, index) => (
        <div className="flex items-center gap-2.5" key={index}>
          <Skeleton className="aspect-[3/4] w-9 shrink-0 rounded-sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}
