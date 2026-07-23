import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROW_COUNT = 4;

export function TimelineSkeleton() {
  const t = useTranslations("timeline");

  return (
    <div aria-busy aria-label={t("states.loading")} className="flex flex-col gap-4" role="status">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
          <Skeleton className="h-20 w-full rounded-lg" key={index} />
        ))}
      </div>
    </div>
  );
}
