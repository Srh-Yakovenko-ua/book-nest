import Image from "next/image";

import type { EmptyStateIllustration, EmptyStateIllustrationSize } from "@/lib/empty-states";

import { cn } from "@/lib/utils";

const ILLU_SIZE = {
  lg: "h-84 w-auto",
  md: "h-70 w-auto",
  sm: "h-56 w-auto",
  xs: "h-36 w-auto",
} as const satisfies Record<EmptyStateIllustrationSize, string>;

type IllustrationProps = {
  className?: string;
  name: EmptyStateIllustration;
  size: EmptyStateIllustrationSize;
};

export function Illustration({ className, name, size }: IllustrationProps) {
  return (
    <Image
      alt=""
      className={cn("object-contain select-none", ILLU_SIZE[size], className)}
      height={352}
      loading="eager"
      src={`/illustrations/${name}.png`}
      width={352}
    />
  );
}
