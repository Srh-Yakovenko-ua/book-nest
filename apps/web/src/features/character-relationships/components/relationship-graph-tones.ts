import type { CharacterGraphClusterView } from "@app/shared";

export type RelationshipGraphTone = (typeof RELATIONSHIP_GRAPH_TONES)[number];

const RELATIONSHIP_GRAPH_TONES = [
  { border: "border-chart-1", swatch: "bg-chart-1" },
  { border: "border-chart-2", swatch: "bg-chart-2" },
  { border: "border-chart-3", swatch: "bg-chart-3" },
  { border: "border-chart-4", swatch: "bg-chart-4" },
  { border: "border-chart-5", swatch: "bg-chart-5" },
] as const;

export function toRelationshipGraphClusterTones(
  clusters: CharacterGraphClusterView[],
): ReadonlyMap<string, RelationshipGraphTone> {
  return new Map(
    clusters.flatMap((cluster, index) => {
      const tone = RELATIONSHIP_GRAPH_TONES[index % RELATIONSHIP_GRAPH_TONES.length];
      return tone === undefined ? [] : [[cluster.id, tone] as const];
    }),
  );
}
