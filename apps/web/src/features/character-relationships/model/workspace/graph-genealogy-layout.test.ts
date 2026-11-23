import type { BookFamilyTreeView, FamilyTreeLineageView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GenealogyLayout } from "./graph-genealogy-layout";

import { makeRelationshipGraphEdge, makeRelationshipGraphNode } from "../relationships.fixtures";
import { toGraphConnections } from "./graph-connections";
import { GENEALOGY_LAYOUT, layoutGenealogyScene } from "./graph-genealogy-layout";
import { buildGenealogyScene, EMPTY_GENEALOGY_EXPANSION } from "./graph-genealogy-scene";
import { TREE_LAYOUT } from "./graph-tree-layout";
import { toTreePairSemanticsById } from "./graph-tree-pairs";
import { TREE_SCENE } from "./graph-tree-scene";

const ELDER = {
  founder: "a1a1a1a1-0000-4000-8000-000000000001",
  grandchild: "a1a1a1a1-0000-4000-8000-000000000003",
  heir: "a1a1a1a1-0000-4000-8000-000000000002",
  spouse: "a1a1a1a1-0000-4000-8000-000000000004",
} as const;

const YOUNGER = {
  child: "b1b1b1b1-0000-4000-8000-000000000002",
  parent: "b1b1b1b1-0000-4000-8000-000000000001",
} as const;

const COUPLE = {
  first: "c1c1c1c1-0000-4000-8000-000000000001",
  second: "c1c1c1c1-0000-4000-8000-000000000002",
} as const;

const TWO_FAMILIES = makeGenealogy({
  ids: [...Object.values(ELDER), ...Object.values(YOUNGER)],
  parentOf: [
    [ELDER.founder, ELDER.heir],
    [ELDER.heir, ELDER.grandchild],
    [YOUNGER.parent, YOUNGER.child],
  ],
  spouseOf: [[ELDER.heir, ELDER.spouse]],
});

describe("layoutGenealogyScene", () => {
  it("lays the families out left to right", () => {
    const layout = layoutFor(TWO_FAMILIES);

    expect(Math.max(...xsOf(layout, Object.values(ELDER)))).toBeLessThan(
      Math.min(...xsOf(layout, Object.values(YOUNGER))),
    );
  });

  it("separates the family frames by the component gap", () => {
    const [first, second] = layoutFor(TWO_FAMILIES).frames;

    expect(second?.left).toBe((first?.right ?? Number.NaN) + GENEALOGY_LAYOUT.componentGap);
  });

  it("positions every shown character", () => {
    const positioned = [...layoutFor(TWO_FAMILIES).positions.keys()].sort();

    expect(positioned).toEqual([...Object.values(ELDER), ...Object.values(YOUNGER)].sort());
  });

  it("puts each row at its row number times the row step", () => {
    const rows = layoutFor(TWO_FAMILIES).rows.map(({ row, y }) => ({ row, y }));

    expect(rows).toEqual([
      { row: 0, y: 0 },
      { row: 1, y: TREE_LAYOUT.rowStep },
      { row: 2, y: 2 * TREE_LAYOUT.rowStep },
    ]);
  });

  it("marks every row that holds lineage characters with its generation", () => {
    const generations = layoutFor(TWO_FAMILIES).rows.map((row) => row.generation);

    expect(generations).toEqual([0, 1, 2]);
  });

  it("leaves the generation empty on a row without lineage characters", () => {
    const layout = layoutFor(
      makeGenealogy({
        ids: Object.values(COUPLE),
        parentOf: [],
        spouseOf: [[COUPLE.first, COUPLE.second]],
      }),
    );

    expect(layout.rows).toEqual([{ generation: null, row: 0, y: 0 }]);
  });
});

function layoutFor(tree: BookFamilyTreeView): GenealogyLayout {
  const scene = buildGenealogyScene({
    expansion: EMPTY_GENEALOGY_EXPANSION,
    options: TREE_SCENE.defaultOptions,
    tree,
  });
  const connections = toGraphConnections(scene.edges);
  const pairs = toTreePairSemanticsById({ connections, entryByEdgeId: scene.entryByEdgeId });
  return layoutGenealogyScene({ connections, pairs, scene });
}

function makeGenealogy({
  ids,
  parentOf,
  spouseOf,
}: {
  ids: readonly string[];
  parentOf: readonly (readonly [string, string])[];
  spouseOf: readonly (readonly [string, string])[];
}): BookFamilyTreeView {
  const parentEdges = parentOf.map(([parentId, childId], index) =>
    makeRelationshipGraphEdge({
      id: toEdgeId("e0e0e0e0", index),
      source: parentId,
      target: childId,
      type: "biological_parent_of",
    }),
  );
  const spouseEdges = spouseOf.map(([leftId, rightId], index) =>
    makeRelationshipGraphEdge({
      directionality: "symmetric",
      id: toEdgeId("e1e1e1e1", index),
      source: leftId,
      target: rightId,
      type: "spouse_of",
    }),
  );
  return {
    diagnostics: [],
    edges: [...parentEdges, ...spouseEdges],
    graphVersion: "genealogy-v1",
    hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: false },
    houses: [],
    lineage: parentEdges.map((edge): FamilyTreeLineageView => ({
      childId: edge.target,
      kind: "biological",
      parentId: edge.source,
      relationshipId: edge.id,
    })),
    nodes: ids.map((id) => makeRelationshipGraphNode({ id })),
    scope: "book",
    updatedAt: null,
  };
}

function toEdgeId(prefix: string, index: number): string {
  return `${prefix}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function xsOf(layout: GenealogyLayout, ids: readonly string[]): number[] {
  return ids.map((id) => layout.positions.get(id)?.x ?? Number.NaN);
}
