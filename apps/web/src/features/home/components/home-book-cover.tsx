import type { MediaView, Nullable } from "@app/shared";

import Image from "next/image";

import { BookCoverFallback } from "@/components/book-cover-fallback";
import { cn } from "@/lib/utils";

type HomeBookCoverProps = {
  className?: string;
  cover: Nullable<MediaView>;
  seed: string;
  sizes: string;
  title?: string;
};

export function HomeBookCover({ className, cover, seed, sizes, title }: HomeBookCoverProps) {
  const src = cover?.urls.card ?? null;

  if (src === null) {
    return (
      <BookCoverFallback
        className={cn("aspect-2/3 rounded-md", className)}
        seed={seed}
        sizes={sizes}
        title={title}
      />
    );
  }

  return (
    <span
      className={cn(
        "relative grid aspect-2/3 shrink-0 place-items-center overflow-hidden rounded-md bg-accent text-accent-foreground/70",
        className,
      )}
    >
      <Image alt="" className="object-contain" fill sizes={sizes} src={src} unoptimized />
    </span>
  );
}
