import type { Nullable } from "@app/shared";

import Image from "next/image";

import { UiIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type DedicationCoverProps = {
  alt: string;
  className: string;
  iconSize: number;
  sizes: string;
  src: Nullable<string>;
};

export function DedicationCover({ alt, className, iconSize, sizes, src }: DedicationCoverProps) {
  if (src === null) {
    return (
      <div
        aria-label={alt}
        className={cn(
          "grid place-items-center rounded-md bg-accent text-accent-foreground/70",
          className,
        )}
        role="img"
      >
        <UiIcon name="book" size={iconSize} />
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-md bg-accent", className)}>
      <Image alt={alt} className="object-cover" fill sizes={sizes} src={src} unoptimized />
    </div>
  );
}
