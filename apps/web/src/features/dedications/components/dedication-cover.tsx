import type { Nullable } from "@app/shared";

import Image from "next/image";

import { BookCoverFallback } from "@/components/book-cover-fallback";
import { cn } from "@/lib/utils";

type DedicationCoverProps = {
  alt: string;
  className: string;
  seed: string;
  sizes: string;
  src: Nullable<string>;
};

export function DedicationCover({ alt, className, seed, sizes, src }: DedicationCoverProps) {
  if (src === null) {
    return (
      <BookCoverFallback
        alt={alt}
        className={cn("rounded-md", className)}
        seed={seed}
        sizes={sizes}
      />
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-md bg-accent", className)}>
      <Image alt={alt} className="object-cover" fill sizes={sizes} src={src} unoptimized />
    </div>
  );
}
