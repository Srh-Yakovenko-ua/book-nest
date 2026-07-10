import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_COUNT = 5;

export function LoansListSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-3">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div
          className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-card"
          key={index}
        >
          <Skeleton className="aspect-[3/4] w-16 shrink-0 rounded-md" />
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-5 w-28 rounded-full" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
