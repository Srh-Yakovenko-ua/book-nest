"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

const PIE_CHART = {
  colors: ["var(--primary)", "var(--success)", "var(--info)"],
  config: {} satisfies ChartConfig,
  size: 140,
} as const;

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
      <div className="shrink-0" style={{ height: PIE_CHART.size, width: PIE_CHART.size }}>
        <ResponsiveContainer height={PIE_CHART.size} width={PIE_CHART.size}>
          <ChartContainer
            aria-label={ariaLabel}
            className="aspect-square size-full"
            config={PIE_CHART.config}
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
                    fill={PIE_CHART.colors[index % PIE_CHART.colors.length]}
                    key={genre.key}
                    stroke="var(--card)"
                  />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </ResponsiveContainer>
      </div>
      <ul className="flex w-full flex-col gap-1.5">
        {genres.map((genre, index) => {
          const percent = total <= 0 ? 0 : Math.round((genre.count / total) * 100);

          return (
            <li className="flex items-center gap-2" key={genre.key}>
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: PIE_CHART.colors[index % PIE_CHART.colors.length] }}
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
