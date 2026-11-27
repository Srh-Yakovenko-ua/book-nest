"use client";

import type { MediaView, Nullable } from "@app/shared";

import Image from "next/image";
import { useState } from "react";

import { BookCoverFallback } from "@/components/book-cover-fallback";
import { cn } from "@/lib/utils";

type CharacterBookCoverProps = {
  className?: string;
  cover: Nullable<MediaView>;
  seed: string;
};

export function CharacterBookCover({ className, cover, seed }: CharacterBookCoverProps) {
  const [failedSrc, setFailedSrc] = useState<Nullable<string>>(null);
  const src = cover?.urls.thumb ?? null;

  return (
    <span
      className={cn(
        "relative block aspect-3/4 shrink-0 overflow-hidden rounded-sm bg-accent shadow-soft",
        className,
      )}
    >
      {src === null || src === failedSrc ? (
        <BookCoverFallback className="size-full" seed={seed} sizes="40px" />
      ) : (
        <Image
          alt=""
          className="object-cover"
          fill
          onError={() => setFailedSrc(src)}
          sizes="40px"
          src={src}
          unoptimized
        />
      )}
    </span>
  );
}
