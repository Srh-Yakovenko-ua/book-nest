import type {
  CharacterGraphEdgeView,
  FamilyTreeGraphView,
  FamilyTreeLineageView,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { TreeLayout } from "./graph-tree-layout";

import { makeRelationshipGraphEdge, makeRelationshipGraphNode } from "../relationships.fixtures";
import { toGraphConnectionId, toGraphConnections } from "./graph-connections";
import { layoutTreeScene, toTreeNodeBox, TREE_LAYOUT } from "./graph-tree-layout";
import { toTreePairSemanticsById } from "./graph-tree-pairs";
import { buildTreeScene, TREE_SCENE } from "./graph-tree-scene";

const FAMILY = {
  child: "d4d4d4d4-0000-4000-8000-000000000001",
  father: "d4d4d4d4-0000-4000-8000-000000000002",
  mother: "d4d4d4d4-0000-4000-8000-000000000003",
  root: "d4d4d4d4-0000-4000-8000-000000000004",
  spouse: "d4d4d4d4-0000-4000-8000-000000000005",
} as const;

const FAMILY_TREE = makeTree({
  edges: [
    parentEdge({
      childId: FAMILY.root,
      id: "d5d5d5d5-0000-4000-8000-000000000001",
      parentId: FAMILY.father,
    }),
    parentEdge({
      childId: FAMILY.root,
      id: "d5d5d5d5-0000-4000-8000-000000000002",
      parentId: FAMILY.mother,
    }),
    parentEdge({
      childId: FAMILY.child,
      id: "d5d5d5d5-0000-4000-8000-000000000003",
      parentId: FAMILY.root,
    }),
    parentEdge({
      childId: FAMILY.child,
      id: "d5d5d5d5-0000-4000-8000-000000000004",
      parentId: FAMILY.spouse,
    }),
    marriageEdge({
      id: "d5d5d5d5-0000-4000-8000-000000000005",
      left: FAMILY.root,
      right: FAMILY.spouse,
    }),
  ],
  rootId: FAMILY.root,
});

const MARRIAGES = {
  first: "d6d6d6d6-0000-4000-8000-000000000001",
  root: "d6d6d6d6-0000-4000-8000-000000000002",
  second: "d6d6d6d6-0000-4000-8000-000000000003",
} as const;

const LARGE_FAMILY = {
  children: Array.from({ length: 13 }, (_, index) => sequenceId("d7d7d7d7", index + 1)),
  root: "d8d8d8d8-0000-4000-8000-000000000001",
  spouse: "d8d8d8d8-0000-4000-8000-000000000002",
} as const;

describe("layoutTreeScene", () => {
  it("places the root at the origin", () => {
    const layout = layoutFor(FAMILY_TREE);

    expect(layout.positions.get(FAMILY.root)).toEqual({ x: 0, y: 0 });
  });

  it("places parents one row step above the root and children one row step below", () => {
    const { positions } = layoutFor(FAMILY_TREE);

    expect({
      child: positions.get(FAMILY.child)?.y,
      father: positions.get(FAMILY.father)?.y,
      mother: positions.get(FAMILY.mother)?.y,
    }).toEqual({
      child: TREE_LAYOUT.rowStep,
      father: -TREE_LAYOUT.rowStep,
      mother: -TREE_LAYOUT.rowStep,
    });
  });

  it("places every character of the tree exactly once", () => {
    const layout = layoutFor(FAMILY_TREE);

    expect([...layout.positions.keys()].sort()).toEqual(Object.values(FAMILY).sort());
  });

  it("keeps the characters of one row from overlapping", () => {
    const layout = layoutFor(FAMILY_TREE);

    expect(findOverlaps({ layout, rootId: FAMILY.root })).toEqual([]);
  });

  it.each([
    { child: FAMILY.root, label: "the root", parents: [FAMILY.father, FAMILY.mother] },
    { child: FAMILY.child, label: "the root's child", parents: [FAMILY.root, FAMILY.spouse] },
  ])("centres $label between its two parents", ({ child, parents }) => {
    const { positions } = layoutFor(FAMILY_TREE);
    const parentXs = parents.map((id) => positions.get(id)?.x ?? Number.NaN);
    const childX = positions.get(child)?.x ?? Number.NaN;

    expect(childX).toBeGreaterThanOrEqual(Math.min(...parentXs));
    expect(childX).toBeLessThanOrEqual(Math.max(...parentXs));
  });

  it("lays out the same family identically whatever order the server lists it in", () => {
    const reversed = makeTree({ edges: [...FAMILY_TREE.edges].reverse(), rootId: FAMILY.root });

    expect(Object.fromEntries(layoutFor(reversed).positions)).toEqual(
      Object.fromEntries(layoutFor(FAMILY_TREE).positions),
    );
  });

  it("labels each row with the generation it holds", () => {
    const layout = layoutFor(FAMILY_TREE);

    expect(layout.rows).toEqual([
      { generation: -1, row: -1, y: -TREE_LAYOUT.rowStep },
      { generation: 0, row: 0, y: 0 },
      { generation: 1, row: 1, y: TREE_LAYOUT.rowStep },
    ]);
  });

  it("draws no arc between spouses who sit side by side", () => {
    const layout = layoutFor(FAMILY_TREE);

    expect(layout.arcPairIds.has(toGraphConnectionId(FAMILY.root, FAMILY.spouse))).toBe(false);
  });

  it("draws an arc for the one marriage that has another character between the spouses", () => {
    const tree = makeTree({
      edges: [
        marriageEdge({
          id: "d9d9d9d9-0000-4000-8000-000000000001",
          left: MARRIAGES.root,
          right: MARRIAGES.first,
        }),
        marriageEdge({
          id: "d9d9d9d9-0000-4000-8000-000000000002",
          left: MARRIAGES.root,
          right: MARRIAGES.second,
        }),
        marriageEdge({
          id: "d9d9d9d9-0000-4000-8000-000000000003",
          left: MARRIAGES.first,
          right: MARRIAGES.second,
        }),
      ],
      rootId: MARRIAGES.root,
    });
    const layout = layoutFor(tree);
    const xOf = (id: string) => layout.positions.get(id)?.x ?? Number.NaN;
    const byX = Object.values(MARRIAGES).sort((left, right) => xOf(left) - xOf(right));
    const outerPair = toGraphConnectionId(byX.at(0) ?? "", byX.at(-1) ?? "");

    expect(layout.arcPairIds).toEqual(new Set([outerPair]));
  });

  it("puts all thirteen children of one couple on the row below without overlap", () => {
    const tree = makeTree({
      edges: [
        marriageEdge({
          id: "dadadada-0000-4000-8000-000000000001",
          left: LARGE_FAMILY.root,
          right: LARGE_FAMILY.spouse,
        }),
        ...LARGE_FAMILY.children.flatMap((childId, index) => [
          parentEdge({
            childId,
            id: sequenceId("dbdbdbdb", index + 1),
            parentId: LARGE_FAMILY.root,
          }),
          parentEdge({
            childId,
            id: sequenceId("dcdcdcdc", index + 1),
            parentId: LARGE_FAMILY.spouse,
          }),
        ]),
      ],
      rootId: LARGE_FAMILY.root,
    });
    const layout = layoutFor(tree);

    expect({
      overlaps: findOverlaps({ layout, rootId: LARGE_FAMILY.root }),
      rows: LARGE_FAMILY.children.map((id) => layout.positions.get(id)?.y),
    }).toEqual({
      overlaps: [],
      rows: LARGE_FAMILY.children.map(() => TREE_LAYOUT.rowStep),
    });
  });
});

function findOverlaps({ layout, rootId }: { layout: TreeLayout; rootId: string }): string[][] {
  const placed = [...layout.positions.entries()];
  return placed.flatMap(([leftId, left], index) =>
    placed.slice(index + 1).flatMap(([rightId, right]) => {
      if (left.y !== right.y) return [];
      const clearance =
        (toTreeNodeBox(leftId === rootId).width + toTreeNodeBox(rightId === rootId).width) / 2;
      return Math.abs(left.x - right.x) >= clearance ? [] : [[leftId, rightId]];
    }),
  );
}

function layoutFor(tree: FamilyTreeGraphView): TreeLayout {
  const scene = buildTreeScene({ options: TREE_SCENE.defaultOptions, tree });
  const connections = toGraphConnections(scene.edges);
  const pairs = toTreePairSemanticsById({ connections, entryByEdgeId: scene.entryByEdgeId });
  return layoutTreeScene({ connections, pairs, scene });
}

function makeTree({
  edges,
  rootId,
}: {
  edges: CharacterGraphEdgeView[];
  rootId: string;
}): FamilyTreeGraphView {
  const ids = new Set([rootId, ...edges.flatMap((edge) => [edge.source, edge.target])]);
  return {
    ancestors: 2,
    descendants: 2,
    diagnostics: [],
    edges,
    focusCharacterId: rootId,
    graphVersion: "tree-v1",
    hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: false },
    lineage: edges.flatMap((edge): FamilyTreeLineageView[] =>
      edge.type === "biological_parent_of"
        ? [
            {
              childId: edge.target,
              kind: "biological",
              parentId: edge.source,
              relationshipId: edge.id,
            },
          ]
        : [],
    ),
    nodes: [...ids].map((id) => makeRelationshipGraphNode({ id })),
    projection: "family_tree",
    updatedAt: null,
  };
}

function marriageEdge({
  id,
  left,
  right,
}: {
  id: string;
  left: string;
  right: string;
}): CharacterGraphEdgeView {
  return makeRelationshipGraphEdge({
    directionality: "symmetric",
    id,
    source: left,
    target: right,
    type: "spouse_of",
  });
}

function parentEdge({
  childId,
  id,
  parentId,
}: {
  childId: string;
  id: string;
  parentId: string;
}): CharacterGraphEdgeView {
  return makeRelationshipGraphEdge({
    id,
    source: parentId,
    target: childId,
    type: "biological_parent_of",
  });
}

function sequenceId(prefix: string, index: number): string {
  return `${prefix}-0000-4000-8000-${String(index).padStart(12, "0")}`;
}
