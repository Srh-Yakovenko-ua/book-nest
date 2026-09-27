import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TimelineSkeletonProps = {
  shape: "list" | "stream";
};

const SKELETON = {
  listRows: 6,
  mobileRows: 4,
  streamRows: 4,
} as const;

export function TimelineSkeleton({ shape }: TimelineSkeletonProps) {
  const t = useTranslations("timeline");

  return (
    <div aria-busy aria-label={t("states.loading")} className="flex flex-col gap-4" role="status">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      {shape === "list" ? <ListShapeSkeleton /> : <StreamShapeSkeleton />}
    </div>
  );
}

function ListShapeSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="border-b border-border bg-secondary/40 px-3 py-2.5">
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: SKELETON.listRows }, (_, index) => (
          <div
            className={cn("px-3 py-3", index >= SKELETON.mobileRows ? "hidden md:block" : null)}
            key={index}
          >
            <Skeleton className="h-9 w-full md:h-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StreamShapeSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: SKELETON.streamRows }, (_, index) => (
        <div className="flex gap-3" key={index}>
          <div className="flex w-3 flex-col items-center pt-2.5">
            <Skeleton className="size-2.5 rounded-full" />
            {index < SKELETON.streamRows - 1 ? (
              <span aria-hidden className="mt-1 w-px flex-1 bg-border" />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pb-3">
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}
