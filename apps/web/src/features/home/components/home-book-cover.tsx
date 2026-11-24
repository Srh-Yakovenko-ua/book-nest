import type { MediaView, Nullable } from "@app/shared";

import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type HomeBookCoverProps = {
  className?: string;
  cover: Nullable<MediaView>;
  sizes: string;
};

export function HomeBookCover({ className, cover, sizes }: HomeBookCoverProps) {
  const src = cover?.urls.card ?? null;

  return (
    <span
      className={cn(
        "relative grid aspect-2/3 shrink-0 place-items-center overflow-hidden rounded-md bg-accent text-accent-foreground/70",
        className,
      )}
    >
      {src === null ? (
        <UiIcon aria-hidden name="book" size={24} />
      ) : (
        <Image alt="" className="object-contain" fill sizes={sizes} src={src} unoptimized />
      )}
    </span>
  );
}
