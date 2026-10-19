import { Skeleton } from "@/components/ui/skeleton";

export function CharacterFactCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <Skeleton className="h-5 w-2/3" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3.5 w-full" />
        <Skeleton className="h-3.5 w-11/12" />
        <Skeleton className="h-3.5 w-2/3" />
      </div>
      <Skeleton className="h-3 w-32" />
    </div>
  );
}
