import { cn } from "@/lib/utils";

export type HomeLayoutCell = {
  className: string;
  zone: HomeZoneKey;
};

export type HomeLayoutRow = {
  cells: HomeLayoutCell[];
  className: string;
  key: HomeRowKey;
};

export type HomeRowKey = "banner" | "lower" | "middle" | "primary";

export type HomeZoneKey =
  | "attention"
  | "criticalBanner"
  | "currentlyReading"
  | "memory"
  | "nextRead"
  | "readingGoal"
  | "readingWeek"
  | "recentBooks";

export type HomeZonePresence = Record<HomeZoneKey, boolean>;

type HomeRowDefinition = {
  key: HomeRowKey;
  zones: readonly HomeZoneKey[];
};

type HomeRowLayout = {
  grid: string;
  spans: readonly string[];
};

const HOME_ROWS: readonly HomeRowDefinition[] = [
  { key: "banner", zones: ["criticalBanner"] },
  { key: "primary", zones: ["currentlyReading", "readingWeek"] },
  { key: "middle", zones: ["readingGoal", "nextRead", "memory"] },
  { key: "lower", zones: ["attention", "recentBooks"] },
];

const HOME_SINGLE_ROW: HomeRowLayout = { grid: "", spans: [""] };

const HOME_ROW_LAYOUTS: Record<HomeRowKey, readonly HomeRowLayout[]> = {
  banner: [HOME_SINGLE_ROW],
  lower: [
    HOME_SINGLE_ROW,
    {
      grid: "@5xl/home:grid-cols-2 @6xl/home:grid-cols-20",
      spans: ["@6xl/home:col-span-9", "@6xl/home:col-span-11"],
    },
  ],
  middle: [
    HOME_SINGLE_ROW,
    { grid: "@2xl/home:grid-cols-2", spans: ["", ""] },
    {
      grid: "@2xl/home:grid-cols-2 @5xl/home:grid-cols-3",
      spans: ["", "", "@2xl/home:col-span-2 @5xl/home:col-span-1"],
    },
  ],
  primary: [
    HOME_SINGLE_ROW,
    {
      grid: "@5xl/home:grid-cols-20",
      spans: [
        "@5xl/home:col-span-12 @6xl/home:col-span-13",
        "@5xl/home:col-span-8 @6xl/home:col-span-7",
      ],
    },
  ],
};

const HOME_LAYOUT_CLASSES = {
  cell: "flex min-w-0 flex-col *:flex-1",
  row: "grid grid-cols-1 gap-3 @6xl/home:gap-4",
} as const;

export function homeLayoutRows(presence: HomeZonePresence): HomeLayoutRow[] {
  return HOME_ROWS.flatMap(({ key, zones }) => {
    const presentZones = zones.filter((zone) => presence[zone]);
    if (presentZones.length === 0) return [];

    const layout = HOME_ROW_LAYOUTS[key][presentZones.length - 1] ?? HOME_SINGLE_ROW;
    return [
      {
        cells: presentZones.map((zone, index) => ({
          className: cn(HOME_LAYOUT_CLASSES.cell, layout.spans[index]),
          zone,
        })),
        className: cn(HOME_LAYOUT_CLASSES.row, layout.grid),
        key,
      },
    ];
  });
}
