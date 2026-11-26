"use client";

import type { Nullable } from "@app/shared";

import { UiIcon } from "@/components/icons";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const SERIES_RANKING_ROW = "flex min-h-9 items-center gap-3 rounded-lg bg-secondary/50 px-3 py-1.5";

type SeriesRankingRow = {
  href: Nullable<string>;
  key: string;
  name: string;
  value: number;
  valueLabel: string;
};

export function SeriesRankingList({
  label,
  rows,
}: {
  label: string;
  rows: readonly SeriesRankingRow[];
}) {
  return (
    <ol aria-label={label} className="flex flex-col gap-1.5">
      {rows.map((row) => (
        <li key={row.key}>
          <SeriesRankingEntry rank={competitionRank(rows, row.value)} row={row} />
        </li>
      ))}
    </ol>
  );
}

function competitionRank(rows: readonly SeriesRankingRow[], value: number): number {
  return rows.filter((row) => row.value > value).length + 1;
}

function SeriesRankingEntry({ rank, row }: { rank: number; row: SeriesRankingRow }) {
  const content = (
    <>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground tabular-nums">
        {rank}
      </span>
      <span className="min-w-0 flex-1 text-sm font-medium break-words text-foreground">
        {row.name}
      </span>
      <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
        {row.valueLabel}
      </span>
    </>
  );

  if (row.href === null) return <div className={SERIES_RANKING_ROW}>{content}</div>;

  return (
    <Link
      className={cn(
        SERIES_RANKING_ROW,
        "group/series-row cursor-pointer outline-none hover:bg-secondary focus-visible:ring-3 focus-visible:ring-ring/50 motion-safe:transition-colors",
      )}
      href={row.href}
    >
      {content}
      <UiIcon
        aria-hidden
        className="shrink-0 text-muted-foreground group-hover/series-row:text-primary"
        name="chevron-right"
        size={16}
      />
    </Link>
  );
}
