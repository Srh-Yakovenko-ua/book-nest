import type { PublisherOverviewWishlistBook } from "@app/shared";
import type { ReactNode } from "react";

import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";

type PublisherOverviewBookRowProps = {
  book: Pick<PublisherOverviewWishlistBook, "authors" | "cover" | "id" | "title">;
  children?: ReactNode;
};

export function PublisherOverviewBookRow({ book, children }: PublisherOverviewBookRowProps) {
  const { authors, cover, id, title } = book;
  const authorNames = authors.map((author) => author.name).join(", ");

  return (
    <Link
      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      href={`/books/${id}`}
    >
      <span
        aria-hidden
        className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-accent shadow-soft"
      >
        {cover === null ? (
          <span className="grid h-full place-items-center text-accent-foreground/70">
            <UiIcon name="book" size={14} />
          </span>
        ) : (
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="44px"
            src={cover.urls.thumb}
            unoptimized
          />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-semibold text-foreground">{title}</span>
        {authorNames === "" ? null : (
          <span className="truncate text-xs text-muted-foreground">{authorNames}</span>
        )}
        {children}
      </span>
    </Link>
  );
}
