import type { Nullable } from "@app/shared";

import Image from "next/image";

import type { EmptyStateIllustration, EmptyStateIllustrationSize } from "@/lib/empty-states";

import { cn } from "@/lib/utils";

type IllustrationFormat = {
  height: number;
  lgScale: IllustrationLgScale;
  width: number;
};

type IllustrationLgScale = "capped" | "full";

type IllustrationScaleStep = {
  className: string;
  height: number;
  media: Nullable<string>;
};

const ILLUSTRATION_FORMAT = {
  landscape: { height: 1086, lgScale: "capped", width: 1448 },
  square: { height: 1024, lgScale: "full", width: 1024 },
  squarish: { height: 1199, lgScale: "full", width: 1312 },
  wide: { height: 1024, lgScale: "capped", width: 1536 },
} as const satisfies Record<string, IllustrationFormat>;

const ILLUSTRATION_FORMAT_BY_ART = {
  "character-relationships/person-guided-start": "landscape",
  "email-sent": "square",
  "email-verified": "square",
  "empty-all-books": "wide",
  "empty-authors": "square",
  "empty-borrowed": "square",
  "empty-characters": "square",
  "empty-contacts": "square",
  "empty-dedications": "square",
  "empty-delivery": "wide",
  "empty-favorites": "square",
  "empty-genres": "wide",
  "empty-library": "wide",
  "empty-lists": "wide",
  "empty-notes": "square",
  "empty-publishers": "square",
  "empty-purchases": "square",
  "empty-queue": "wide",
  "empty-quotes": "square",
  "empty-reading-history-en": "square",
  "empty-reading-history-uk": "square",
  "empty-search": "square",
  "empty-series": "wide",
  "empty-tags": "square",
  "error-generic": "square",
  "error-not-found": "wide",
  maintenance: "wide",
  "reading-goals/goal-expired-hourglass": "squarish",
  "reading-goals/goal-first-goal-empty-state": "squarish",
  "reading-goals/goal-no-counted-books-yet": "square",
} as const satisfies Record<EmptyStateIllustration, keyof typeof ILLUSTRATION_FORMAT>;

const ILLUSTRATION_MEDIA = {
  lgTall: "(min-width: 64rem) and (min-height: 50rem)",
  md: "(min-width: 48rem)",
  smTall: "(min-width: 40rem) and (min-height: 50rem)",
} as const;

const ILLUSTRATION_SCALE = {
  lg: {
    capped: [
      { className: "sm:tall:h-48", height: 192, media: ILLUSTRATION_MEDIA.smTall },
      { className: "h-36", height: 144, media: null },
    ],
    full: [
      { className: "lg:tall:h-56", height: 224, media: ILLUSTRATION_MEDIA.lgTall },
      { className: "sm:tall:h-48", height: 192, media: ILLUSTRATION_MEDIA.smTall },
      { className: "h-36", height: 144, media: null },
    ],
  },
  sm: [{ className: "h-56", height: 224, media: null }],
  xl: [
    { className: "md:h-70", height: 280, media: ILLUSTRATION_MEDIA.md },
    { className: "h-56", height: 224, media: null },
  ],
  xs: [{ className: "h-36", height: 144, media: null }],
} as const satisfies {
  lg: Record<IllustrationLgScale, readonly IllustrationScaleStep[]>;
  sm: readonly IllustrationScaleStep[];
  xl: readonly IllustrationScaleStep[];
  xs: readonly IllustrationScaleStep[];
};

type IllustrationProps = {
  className?: string;
  name: EmptyStateIllustration;
  size: EmptyStateIllustrationSize;
};

export function Illustration({ className, name, size }: IllustrationProps) {
  const format = ILLUSTRATION_FORMAT[ILLUSTRATION_FORMAT_BY_ART[name]];
  const steps = scaleSteps({ lgScale: format.lgScale, size });

  return (
    <Image
      alt=""
      className={cn(
        "w-auto object-contain select-none",
        steps.map((step) => step.className),
        className,
      )}
      height={format.height}
      loading="eager"
      sizes={sizesHint({ format, steps })}
      src={`/illustrations/${name}.png`}
      width={format.width}
    />
  );
}

function scaleSteps({
  lgScale,
  size,
}: {
  lgScale: IllustrationLgScale;
  size: EmptyStateIllustrationSize;
}): readonly IllustrationScaleStep[] {
  if (size === "lg") return ILLUSTRATION_SCALE.lg[lgScale];
  return ILLUSTRATION_SCALE[size];
}

function sizesHint({
  format,
  steps,
}: {
  format: IllustrationFormat;
  steps: readonly IllustrationScaleStep[];
}): string {
  return steps
    .map(({ height, media }) => {
      const width = `${Math.round((height * format.width) / format.height)}px`;
      return media === null ? width : `${media} ${width}`;
    })
    .join(", ");
}
