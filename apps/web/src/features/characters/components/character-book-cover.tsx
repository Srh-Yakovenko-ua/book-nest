"use client";

import type { MediaView, Nullable } from "@app/shared";

import Image from "next/image";
import { useState } from "react";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type CharacterBookCoverProps = {
  className?: string;
  cover: Nullable<MediaView>;
};

export function CharacterBookCover({ className, cover }: CharacterBookCoverProps) {
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
        <span className="grid size-full place-items-center text-accent-foreground/70">
          <UiIcon name="book" size={14} />
        </span>
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
