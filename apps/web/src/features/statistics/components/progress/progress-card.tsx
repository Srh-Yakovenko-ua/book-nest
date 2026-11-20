import type { ReactNode } from "react";

import Image from "next/image";

import type { UiIconName } from "@/components/icons";

import { UiIcon } from "@/components/icons";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PROGRESS_ILLUSTRATION = {
  goal: {
    className: "w-20 @lg:w-26 @xl:w-28",
    renderedSize: 112,
    src: "/illustrations/statistics/progress/goal-tea-books.png",
  },
  library: {
    className: "w-20 @lg:w-26 @xl:w-28",
    renderedSize: 112,
    src: "/illustrations/statistics/progress/library-books-plant.png",
  },
  records: {
    className: "w-14 @lg:w-16 @xl:w-18",
    renderedSize: 72,
    src: "/illustrations/statistics/progress/records-trophy.png",
  },
  series: {
    className: "w-20 @lg:w-26 @xl:w-28",
    renderedSize: 112,
    src: "/illustrations/statistics/progress/series-book-stack.png",
  },
} as const satisfies Record<string, { className: string; renderedSize: number; src: string }>;

type ProgressIllustrationName = keyof typeof PROGRESS_ILLUSTRATION;

export function ProgressCard({
  action,
  children,
  description,
  icon,
  illustration,
  lead,
  title,
}: {
  action?: ReactNode;
  children?: ReactNode;
  description?: ReactNode;
  icon: UiIconName;
  illustration: ProgressIllustrationName;
  lead?: ReactNode;
  title: string;
}) {
  const art = PROGRESS_ILLUSTRATION[illustration];

  return (
    <Card className="@container min-w-0 gap-3">
      <div className="flex items-center gap-4 px-4">
        <Image
          alt=""
          aria-hidden
          className={cn(
            "pointer-events-none hidden h-auto shrink-0 object-contain select-none @md:block",
            art.className,
          )}
          height={art.renderedSize}
          src={art.src}
          width={art.renderedSize}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-1 basis-48 flex-col gap-1">
              <h2 className="flex items-center gap-2 font-heading text-lg leading-snug font-semibold text-ink">
                <UiIcon aria-hidden className="shrink-0 text-primary" name={icon} size={20} />
                <span className="min-w-0 break-words">{title}</span>
              </h2>
              {description === undefined ? null : (
                <p className="text-sm text-muted-foreground">{description}</p>
              )}
            </div>
            {action === undefined ? null : <div className="max-w-full shrink-0">{action}</div>}
          </div>
          {lead}
        </div>
      </div>
      {children === undefined ? null : <div className="flex flex-col gap-3 px-4">{children}</div>}
    </Card>
  );
}

export function progressFigure(chunks: ReactNode) {
  return (
    <span className="font-heading text-3xl leading-none font-semibold text-ink tabular-nums">
      {chunks}
    </span>
  );
}
