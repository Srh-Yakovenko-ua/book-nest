import type { RelationshipGraphPoint } from "../relationship-graph-layout";
import type { GraphConnection } from "./graph-connections";
import type { GenealogyScene } from "./graph-genealogy-scene";
import type { TreeLayoutRow } from "./graph-tree-layout";
import type { TreePairSemantics } from "./graph-tree-pairs";

import { layoutTreeScene, TREE_LAYOUT } from "./graph-tree-layout";

export const GENEALOGY_LAYOUT = {
  componentGap: 280,
  revision: "genealogy-1",
} as const;

export type GenealogyFrame = {
  bottom: number;
  componentId: string;
  left: number;
  right: number;
  top: number;
};

export type GenealogyLayout = {
  arcPairIds: ReadonlySet<string>;
  frames: readonly GenealogyFrame[];
  positions: ReadonlyMap<string, RelationshipGraphPoint>;
  rows: readonly TreeLayoutRow[];
};

export function layoutGenealogyScene({
  connections,
  pairs,
  scene,
}: {
  connections: readonly GraphConnection[];
  pairs: ReadonlyMap<string, TreePairSemantics>;
  scene: GenealogyScene;
}): GenealogyLayout {
  const { height, width } = TREE_LAYOUT.node.default;
  const positions = new Map<string, RelationshipGraphPoint>();
  const arcPairIds = new Set<string>();
  const frames: GenealogyFrame[] = [];
  let cursor = 0;

  for (const component of scene.components) {
    const members = new Set(component.memberIds);
    const inComponent = (id: string) => members.has(id);
    const layout = layoutTreeScene({
      connections: connections.filter(
        (connection) => inComponent(connection.sourceId) && inComponent(connection.targetId),
      ),
      pairs,
      scene: {
        edges: scene.edges.filter((edge) => inComponent(edge.source) && inComponent(edge.target)),
        entryByEdgeId: scene.entryByEdgeId,
        generationById: scene.generationById,
        lineage: scene.lineage.filter(
          (link) => inComponent(link.parentId) && inComponent(link.childId),
        ),
        nodes: scene.nodes.filter((node) => inComponent(node.id)),
        rootId: null,
        rowById: scene.rowById,
        sideAnchorById: new Map(
          [...scene.sideAnchorById].filter(([sideId]) => inComponent(sideId)),
        ),
      },
    });
    const xs = [...layout.positions.values()].map((point) => point.x);
    const ys = [...layout.positions.values()].map((point) => point.y);
    if (xs.length === 0) continue;
    const left = Math.min(...xs) - width / 2;
    const right = Math.max(...xs) + width / 2;
    const shift = cursor - left;
    for (const [id, point] of layout.positions) {
      positions.set(id, { x: Math.round(point.x + shift), y: point.y });
    }
    for (const id of layout.arcPairIds) arcPairIds.add(id);
    frames.push({
      bottom: Math.max(...ys) + height / 2,
      componentId: component.id,
      left: cursor,
      right: right + shift,
      top: Math.min(...ys) - height / 2,
    });
    cursor = right + shift + GENEALOGY_LAYOUT.componentGap;
  }

  const rowNumbers = [...new Set(scene.rowById.values())].sort((left, right) => left - right);
  const generationRows = new Set(scene.generationById.values());
  return {
    arcPairIds,
    frames,
    positions,
    rows: rowNumbers.map((row) => ({
      generation: generationRows.has(row) ? row : null,
      row,
      y: row * TREE_LAYOUT.rowStep,
    })),
  };
}
