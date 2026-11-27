import Image from "next/image";

import { BOOK_COVER_ART, pickBookCoverArt } from "@/lib/book-cover-art";
import { cn } from "@/lib/utils";

const TITLE_TONE_CLASS = {
  ink: "text-cover-ink",
  paper: "text-cover-paper",
} as const;

type BookCoverFallbackProps = {
  alt?: string;
  className?: string;
  "data-slot"?: string;
  seed: string;
  sizes: string;
  title?: string;
};

export function BookCoverFallback({
  alt = "",
  className,
  "data-slot": dataSlot = "book-cover-fallback",
  seed,
  sizes,
  title,
}: BookCoverFallbackProps) {
  const art = pickBookCoverArt(seed);

  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden bg-accent",
        title === undefined ? null : "@container",
        className,
      )}
      data-slot={dataSlot}
    >
      <Image
        alt={alt}
        className="absolute inset-0 size-full object-cover select-none"
        draggable={false}
        height={BOOK_COVER_ART.height}
        sizes={sizes}
        src={art.src}
        width={BOOK_COVER_ART.width}
      />
      {title === undefined ? null : (
        <span
          aria-hidden
          className="absolute inset-x-1/6 top-1/6 bottom-1/3 flex items-center text-cover-title"
          data-slot="book-cover-fallback-title"
        >
          <span
            className={cn(
              "line-clamp-4 w-full text-center font-heading font-semibold text-balance break-words hyphens-auto select-none",
              TITLE_TONE_CLASS[art.titleTone],
            )}
          >
            {title}
          </span>
        </span>
      )}
    </span>
  );
}
