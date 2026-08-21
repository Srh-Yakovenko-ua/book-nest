"use client";

import type { ReactNode } from "react";

import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { MobilePageOverviewLink } from "@/components/ui/mobile-page-overview-panel";

import type { DeliveryBookPreviewModel } from "../model/delivery-book-preview";

export function DeliveryBookCover({
  book,
  sizeClass,
}: {
  book: DeliveryBookPreviewModel;
  sizeClass: string;
}) {
  return (
    <span
      className={`relative shrink-0 overflow-hidden rounded bg-accent shadow-soft ${sizeClass}`}
    >
      {book.coverSrc === undefined ? (
        <span className="grid h-full place-items-center text-accent-foreground/70">
          <UiIcon name="book" size={14} />
        </span>
      ) : (
        <Image
          alt={book.title}
          className="object-cover"
          fill
          sizes="48px"
          src={book.coverSrc}
          unoptimized
        />
      )}
    </span>
  );
}

export function DeliveryBookCoverStack({
  books,
  countText,
}: {
  books: readonly DeliveryBookPreviewModel[];
  countText: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex shrink-0 items-center -space-x-3">
        {books.map((book) => (
          <DeliveryBookCover book={book} key={book.id} sizeClass="h-12 w-9 ring-2 ring-card" />
        ))}
      </span>
      <span className="text-sm font-medium text-ink">{countText}</span>
    </div>
  );
}

export function DeliveryBookLink({ book }: { book: DeliveryBookPreviewModel }) {
  return (
    <DeliveryBookMetaLink
      book={book}
      meta={<span className="truncate text-xs text-muted-foreground">{book.authorName}</span>}
    />
  );
}

export function DeliveryBookMetaLink({
  book,
  meta,
}: {
  book: DeliveryBookPreviewModel;
  meta: ReactNode;
}) {
  return (
    <MobilePageOverviewLink
      className="flex min-w-0 items-center gap-2.5 rounded-md no-underline transition-colors hover:bg-secondary"
      href={book.bookHref}
    >
      <DeliveryBookCover book={book} sizeClass="h-14 w-10" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 font-heading text-sm leading-tight font-semibold text-ink">
          {book.title}
        </span>
        {meta}
      </span>
    </MobilePageOverviewLink>
  );
}
