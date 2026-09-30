import type { PublisherOverviewWishlistBook } from "@app/shared";
import type { ReactNode } from "react";

import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type BookRowVariantStyles = {
  author: string;
  body: string;
  cover: string;
  fallbackIconSize: number;
  row: string;
  sizes: string;
  title: string;
};

type PublisherOverviewBookRowVariant = "compact" | "featured" | "reading";

const BOOK_ROW_VARIANTS = {
  compact: {
    author: "text-xs",
    body: "gap-0.5",
    cover: "h-19 w-13 rounded-md sm:h-20 sm:w-14",
    fallbackIconSize: 16,
    row: "items-center gap-3 py-2.5",
    sizes: "(min-width: 640px) 56px, 52px",
    title: "text-sm",
  },
  featured: {
    author: "text-sm",
    body: "gap-2",
    cover: "h-48 w-32 rounded-lg sm:h-54 sm:w-36",
    fallbackIconSize: 32,
    row: "items-center gap-4 py-1 sm:gap-5",
    sizes: "(min-width: 640px) 144px, 128px",
    title: "font-heading text-xl leading-snug",
  },
  reading: {
    author: "text-sm",
    body: "gap-1.5",
    cover: "h-33 w-22 rounded-md sm:h-36 sm:w-24",
    fallbackIconSize: 22,
    row: "items-center gap-4 py-3",
    sizes: "(min-width: 640px) 96px, 88px",
    title: "text-base",
  },
} as const satisfies Record<PublisherOverviewBookRowVariant, BookRowVariantStyles>;

type PublisherOverviewBookRowProps = {
  book: Pick<PublisherOverviewWishlistBook, "authors" | "cover" | "id" | "title">;
  children?: ReactNode;
  trailing?: ReactNode;
  variant: PublisherOverviewBookRowVariant;
};

export function PublisherOverviewBookRow({
  book,
  children,
  trailing,
  variant,
}: PublisherOverviewBookRowProps) {
  const { authors, cover, id, title } = book;
  const styles = BOOK_ROW_VARIANTS[variant];
  const authorNames = authors.map((author) => author.name).join(", ");

  return (
    <Link
      className={cn(
        "-mx-3 flex cursor-pointer rounded-lg px-3 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        styles.row,
      )}
      href={`/books/${id}`}
    >
      <span
        aria-hidden
        className={cn("relative shrink-0 overflow-hidden bg-accent shadow-soft", styles.cover)}
      >
        {cover === null ? (
          <span className="grid h-full place-items-center text-accent-foreground/70">
            <UiIcon name="book" size={styles.fallbackIconSize} />
          </span>
        ) : (
          <Image
            alt=""
            className="object-cover"
            fill
            sizes={styles.sizes}
            src={cover.urls.thumb}
            unoptimized
          />
        )}
      </span>
      <span className={cn("flex min-w-0 flex-1 flex-col", styles.body)}>
        <span className={cn("truncate font-semibold text-foreground", styles.title)}>{title}</span>
        {authorNames === "" ? null : (
          <span className={cn("truncate text-muted-foreground", styles.author)}>{authorNames}</span>
        )}
        {children}
      </span>
      {trailing === undefined ? null : (
        <span className="flex shrink-0 flex-col items-end justify-center pl-2 text-right">
          {trailing}
        </span>
      )}
    </Link>
  );
}
