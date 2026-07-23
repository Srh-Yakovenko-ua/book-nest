import { Skeleton } from "@/components/ui/skeleton";

export function CharacterCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3.5">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-20 rounded-4xl" />
        </div>
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <Skeleton className="h-4 w-1/3" />
    </div>
  );
}
