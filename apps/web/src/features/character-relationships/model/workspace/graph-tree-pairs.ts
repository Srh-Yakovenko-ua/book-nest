import type { FamilyTreeLineageKind, Nullable } from "@app/shared";

import type { GraphConnection } from "./graph-connections";
import type { TreeEdgeEntry, TreeOptionKey } from "./graph-tree-scene";

export const TREE_PAIR_STYLES = [
  "lineage",
  "conflict",
  "marriages",
  "exUnions",
  "siblings",
  "guardians",
  "distant",
] as const;

export type TreePairLineage = {
  childId: string;
  kind: FamilyTreeLineageKind;
  parentId: string;
};

export type TreePairSemantics = {
  connectionId: string;
  entries: readonly TreeEdgeEntry[];
  lineage: Nullable<TreePairLineage>;
  relationshipCount: number;
  style: TreePairStyle;
  styles: readonly TreePairStyle[];
};

export type TreePairStyle = "conflict" | "lineage" | TreeOptionKey;

export function toTreeEntryStyle(entry: TreeEdgeEntry): TreePairStyle {
  if (entry.kind === "auxiliary") return entry.group;
  return entry.kind;
}

export function toTreePairSemanticsById({
  connections,
  entryByEdgeId,
}: {
  connections: readonly GraphConnection[];
  entryByEdgeId: ReadonlyMap<string, TreeEdgeEntry>;
}): ReadonlyMap<string, TreePairSemantics> {
  return new Map(
    connections.flatMap((connection) => {
      const entries = connection.edgeIds.flatMap((id) => {
        const entry = entryByEdgeId.get(id);
        return entry === undefined ? [] : [entry];
      });
      const styles = TREE_PAIR_STYLES.filter((style) =>
        entries.some((entry) => toTreeEntryStyle(entry) === style),
      );
      const [style] = styles;
      if (style === undefined) return [];
      const lineageEntry = entries.find(
        (entry): entry is Extract<TreeEdgeEntry, { kind: "lineage" }> => entry.kind === "lineage",
      );
      const semantics: TreePairSemantics = {
        connectionId: connection.id,
        entries,
        lineage:
          lineageEntry === undefined
            ? null
            : {
                childId: lineageEntry.childId,
                kind: lineageEntry.lineageKind,
                parentId: lineageEntry.parentId,
              },
        relationshipCount: entries.length,
        style,
        styles,
      };
      return [[connection.id, semantics] as const];
    }),
  );
}
