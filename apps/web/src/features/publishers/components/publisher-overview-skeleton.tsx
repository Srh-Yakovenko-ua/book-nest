import { Skeleton } from "@/components/ui/skeleton";

type SkeletonCard = {
  key: string;
  rows: number;
  withCover: boolean;
};

const OVERVIEW_SKELETON_CARDS = [
  { key: "reading", rows: 2, withCover: true },
  { key: "series", rows: 3, withCover: false },
  { key: "wishlist", rows: 2, withCover: true },
  { key: "latest", rows: 1, withCover: true },
] as const satisfies readonly SkeletonCard[];

export function PublisherOverviewSkeleton() {
  return (
    <>
      {OVERVIEW_SKELETON_CARDS.map((card) => (
        <div
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card"
          key={card.key}
        >
          <Skeleton className="h-4 w-32 rounded-md" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: card.rows }, (_, row) => (
              <div className="flex items-center gap-2.5" key={row}>
                {card.withCover ? <Skeleton className="h-16 w-12 shrink-0 rounded-md" /> : null}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-full rounded-md" />
                  <Skeleton className="h-3 w-2/3 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
