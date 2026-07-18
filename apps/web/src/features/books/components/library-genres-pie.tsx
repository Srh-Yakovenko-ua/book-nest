"use client";

import { Cell, Pie, PieChart } from "recharts";

import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

const SLICE_COLORS = ["var(--primary)", "var(--success)", "var(--info)"] as const;

const CHART_CONFIG: ChartConfig = {};

type GenreSlice = {
  count: number;
  key: string;
  name: string;
};

type LibraryGenresPieProps = {
  ariaLabel: string;
  genres: GenreSlice[];
};

export function LibraryGenresPie({ ariaLabel, genres }: LibraryGenresPieProps) {
  const total = genres.reduce((sum, genre) => sum + genre.count, 0);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="size-[140px] shrink-0">
        <ChartContainer
          aria-label={ariaLabel}
          className="aspect-square size-full"
          config={CHART_CONFIG}
        >
          <PieChart>
            <Pie
              data={genres}
              dataKey="count"
              innerRadius={0}
              isAnimationActive={false}
              nameKey="name"
              outerRadius="100%"
              stroke="var(--card)"
              strokeWidth={2}
            >
              {genres.map((genre, index) => (
                <Cell
                  fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                  key={genre.key}
                  stroke="var(--card)"
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>
      <ul className="flex w-full flex-col gap-1.5">
        {genres.map((genre, index) => {
          const percent = total <= 0 ? 0 : Math.round((genre.count / total) * 100);

          return (
            <li className="flex items-center gap-2" key={genre.key}>
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                {genre.name}
              </span>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                {percent}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
