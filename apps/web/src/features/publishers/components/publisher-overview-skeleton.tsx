import { Skeleton } from "@/components/ui/skeleton";

export function PublisherOverviewSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[56fr_44fr] lg:items-start">
      {[0, 1].map((column) => (
        <div className="flex flex-col gap-3" key={column}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
