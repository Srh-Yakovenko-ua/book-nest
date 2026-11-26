export const GRAPH_GENEALOGY_HOUSE_TONES = [
  { chip: "bg-chart-1/15", dot: "bg-chart-1", miniMap: "var(--chart-1)", stripe: "bg-chart-1" },
  { chip: "bg-chart-4/15", dot: "bg-chart-4", miniMap: "var(--chart-4)", stripe: "bg-chart-4" },
  { chip: "bg-chart-3/15", dot: "bg-chart-3", miniMap: "var(--chart-3)", stripe: "bg-chart-3" },
  { chip: "bg-chart-2/15", dot: "bg-chart-2", miniMap: "var(--chart-2)", stripe: "bg-chart-2" },
  { chip: "bg-chart-5/15", dot: "bg-chart-5", miniMap: "var(--chart-5)", stripe: "bg-chart-5" },
] as const;

export function toGraphGenealogyHouseTone(index: number) {
  const tones = GRAPH_GENEALOGY_HOUSE_TONES;
  return tones[index % tones.length] ?? tones[0];
}
