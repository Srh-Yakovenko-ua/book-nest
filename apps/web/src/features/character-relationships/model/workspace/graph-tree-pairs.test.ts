import type { FamilyTreeGraphView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { TreePairStyle } from "./graph-tree-pairs";
import type { TreeEdgeEntry } from "./graph-tree-scene";

import { makeRelationshipGraphEdge, makeRelationshipGraphNode } from "../relationships.fixtures";
import { toGraphConnectionId, toGraphConnections } from "./graph-connections";
import { toTreeEntryStyle, toTreePairSemanticsById } from "./graph-tree-pairs";
import { buildTreeScene, TREE_SCENE } from "./graph-tree-scene";

const CHARACTER = {
  guardian: "b4b4b4b4-0000-4000-8000-000000000004",
  parent: "b4b4b4b4-0000-4000-8000-000000000009",
  partner: "b4b4b4b4-0000-4000-8000-000000000005",
  root: "b4b4b4b4-0000-4000-8000-000000000001",
} as const;

const EDGE = {
  guardian: makeRelationshipGraphEdge({
    id: "b5b5b5b5-0000-4000-8000-000000000001",
    source: CHARACTER.guardian,
    target: CHARACTER.root,
    type: "guardian_of",
  }),
  parent: makeRelationshipGraphEdge({
    id: "b5b5b5b5-0000-4000-8000-000000000002",
    source: CHARACTER.parent,
    target: CHARACTER.root,
    type: "biological_parent_of",
  }),
  partnerSibling: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "b5b5b5b5-0000-4000-8000-000000000003",
    source: CHARACTER.root,
    target: CHARACTER.partner,
    type: "sibling_of",
  }),
  partnerSpouse: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "b5b5b5b5-0000-4000-8000-000000000004",
    source: CHARACTER.partner,
    target: CHARACTER.root,
    type: "spouse_of",
  }),
};

const TREE: FamilyTreeGraphView = {
  ancestors: 2,
  descendants: 2,
  diagnostics: [],
  edges: Object.values(EDGE),
  focusCharacterId: CHARACTER.root,
  graphVersion: "tree-v1",
  hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: false },
  lineage: [
    {
      childId: CHARACTER.root,
      kind: "biological",
      parentId: CHARACTER.parent,
      relationshipId: EDGE.parent.id,
    },
  ],
  nodes: Object.values(CHARACTER).map((id) => makeRelationshipGraphNode({ id })),
  projection: "family_tree",
  updatedAt: null,
};

describe("toTreePairSemanticsById", () => {
  it("names the parent of a lineage pair even when the parent sorts after the child", () => {
    const pair = treePairs().get(toGraphConnectionId(CHARACTER.root, CHARACTER.parent));

    expect(pair).toMatchObject({
      lineage: { childId: CHARACTER.root, kind: "biological", parentId: CHARACTER.parent },
      relationshipCount: 1,
      style: "lineage",
      styles: ["lineage"],
    });
  });

  it("styles a pair that is both married and siblings as a marriage of two relationships", () => {
    const pair = treePairs().get(toGraphConnectionId(CHARACTER.root, CHARACTER.partner));

    expect(pair).toMatchObject({
      lineage: null,
      relationshipCount: 2,
      style: "marriages",
      styles: ["marriages", "siblings"],
    });
  });

  it("styles a guardian pair as guardians without a lineage", () => {
    const pair = treePairs().get(toGraphConnectionId(CHARACTER.guardian, CHARACTER.root));

    expect(pair).toMatchObject({
      lineage: null,
      relationshipCount: 1,
      style: "guardians",
      styles: ["guardians"],
    });
  });
});

describe("toTreeEntryStyle", () => {
  it.each<{ entry: TreeEdgeEntry; style: TreePairStyle }>([
    {
      entry: { edge: EDGE.guardian, group: "guardians", kind: "auxiliary" },
      style: "guardians",
    },
    {
      entry: { edge: EDGE.partnerSibling, group: "siblings", kind: "auxiliary" },
      style: "siblings",
    },
    {
      entry: { edge: EDGE.partnerSpouse, group: "exUnions", kind: "auxiliary" },
      style: "exUnions",
    },
    { entry: { edge: EDGE.parent, kind: "conflict" }, style: "conflict" },
    {
      entry: {
        childId: CHARACTER.root,
        edge: EDGE.parent,
        kind: "lineage",
        lineageKind: "step",
        parentId: CHARACTER.parent,
      },
      style: "lineage",
    },
  ])("maps a $entry.kind entry to the $style style", ({ entry, style }) => {
    expect(toTreeEntryStyle(entry)).toBe(style);
  });
});

function treePairs() {
  const scene = buildTreeScene({ options: TREE_SCENE.defaultOptions, tree: TREE });
  return toTreePairSemanticsById({
    connections: toGraphConnections(scene.edges),
    entryByEdgeId: scene.entryByEdgeId,
  });
}
