import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SkeletonBlock = {
  cover: string;
  key: string;
  lines: readonly string[];
  rows: number;
};

const OVERVIEW_SKELETON_COLUMNS = {
  left: [
    { cover: "h-48 w-32 sm:h-54 sm:w-36", key: "latest", lines: ["h-5 w-48", "h-4 w-32"], rows: 1 },
    { cover: "size-10 rounded-xl", key: "series", lines: ["h-4 w-40", "h-3 w-28"], rows: 3 },
  ],
  right: [
    {
      cover: "h-33 w-22 sm:h-36 sm:w-24",
      key: "reading",
      lines: ["h-4 w-40", "h-3 w-24"],
      rows: 2,
    },
    {
      cover: "h-19 w-13 sm:h-20 sm:w-14",
      key: "wishlist",
      lines: ["h-4 w-36", "h-3 w-20"],
      rows: 3,
    },
  ],
} as const satisfies Record<"left" | "right", readonly SkeletonBlock[]>;

export function PublisherOverviewSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[56fr_44fr] lg:items-start">
      {Object.entries(OVERVIEW_SKELETON_COLUMNS).map(([column, blocks]) => (
        <div className="flex flex-col gap-6" key={column}>
          {blocks.map((block) => (
            <PublisherOverviewSkeletonBlock block={block} key={block.key} />
          ))}
        </div>
      ))}
    </div>
  );
}

function PublisherOverviewSkeletonBlock({ block }: { block: SkeletonBlock }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <Skeleton className="h-6 w-40 rounded-md" />
      <div className="flex flex-col divide-y divide-border/70">
        {Array.from({ length: block.rows }, (_, row) => (
          <div className="flex items-center gap-3 py-3" key={row}>
            <Skeleton className={cn("shrink-0 rounded-md", block.cover)} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {block.lines.map((line) => (
                <Skeleton className={cn("max-w-full rounded-md", line)} key={line} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
