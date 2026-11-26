import type { GraphConnection } from "./graph-connections";
import type { TreePairSemantics } from "./graph-tree-pairs";
import type { TreeEdgeEntry } from "./graph-tree-scene";

const RELATIVE_RANK = {
  child: 4,
  conflict: 7,
  distant: 6,
  exUnions: 2,
  guardians: 5,
  marriages: 1,
  parent: 0,
  siblings: 3,
} as const;

export type TreeRelative = {
  connectionId: string;
  entries: readonly TreeEdgeEntry[];
  otherId: string;
  rank: number;
};

export function toTreeRelatives({
  characterId,
  connections,
  nameOf,
  pairs,
}: {
  characterId: string;
  connections: readonly GraphConnection[];
  nameOf: (id: string) => string;
  pairs: ReadonlyMap<string, TreePairSemantics>;
}): TreeRelative[] {
  return connections
    .flatMap((connection): TreeRelative[] => {
      if (connection.sourceId !== characterId && connection.targetId !== characterId) return [];
      const pair = pairs.get(connection.id);
      if (pair === undefined) return [];
      return [
        {
          connectionId: connection.id,
          entries: pair.entries,
          otherId: connection.sourceId === characterId ? connection.targetId : connection.sourceId,
          rank: Math.min(...pair.entries.map((entry) => toEntryRank({ characterId, entry }))),
        },
      ];
    })
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        nameOf(left.otherId).localeCompare(nameOf(right.otherId), undefined, {
          sensitivity: "base",
        }) ||
        left.connectionId.localeCompare(right.connectionId),
    );
}

function toEntryRank({
  characterId,
  entry,
}: {
  characterId: string;
  entry: TreeEdgeEntry;
}): number {
  if (entry.kind === "lineage") {
    return entry.childId === characterId ? RELATIVE_RANK.parent : RELATIVE_RANK.child;
  }
  if (entry.kind === "conflict") return RELATIVE_RANK.conflict;
  return RELATIVE_RANK[entry.group];
}
