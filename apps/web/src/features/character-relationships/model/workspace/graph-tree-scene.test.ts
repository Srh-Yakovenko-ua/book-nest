import type { CharacterGraphEdgeView, FamilyTreeGraphView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { TreeOptionKey } from "./graph-tree-scene";

import { makeRelationshipGraphEdge, makeRelationshipGraphNode } from "../relationships.fixtures";
import { buildTreeScene, TREE_SCENE } from "./graph-tree-scene";

const CHARACTER = {
  child: "a1a1a1a1-0000-4000-8000-000000000002",
  ex: "a1a1a1a1-0000-4000-8000-000000000003",
  guardian: "a1a1a1a1-0000-4000-8000-000000000004",
  parent: "a1a1a1a1-0000-4000-8000-000000000005",
  root: "a1a1a1a1-0000-4000-8000-000000000001",
  sibling: "a1a1a1a1-0000-4000-8000-000000000006",
  spouse: "a1a1a1a1-0000-4000-8000-000000000007",
  stranger: "a1a1a1a1-0000-4000-8000-000000000008",
} as const;

const EDGE = {
  child: makeRelationshipGraphEdge({
    id: "e1e1e1e1-0000-4000-8000-000000000001",
    source: CHARACTER.root,
    target: CHARACTER.child,
    type: "biological_parent_of",
  }),
  exSpouse: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "e1e1e1e1-0000-4000-8000-000000000002",
    source: CHARACTER.root,
    target: CHARACTER.ex,
    type: "ex_spouse_of",
  }),
  guardian: makeRelationshipGraphEdge({
    id: "e1e1e1e1-0000-4000-8000-000000000003",
    source: CHARACTER.guardian,
    target: CHARACTER.root,
    type: "guardian_of",
  }),
  parent: makeRelationshipGraphEdge({
    id: "e1e1e1e1-0000-4000-8000-000000000004",
    source: CHARACTER.parent,
    target: CHARACTER.root,
    type: "biological_parent_of",
  }),
  sibling: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "e1e1e1e1-0000-4000-8000-000000000005",
    source: CHARACTER.root,
    target: CHARACTER.sibling,
    type: "sibling_of",
  }),
  spouse: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "e1e1e1e1-0000-4000-8000-000000000006",
    source: CHARACTER.root,
    target: CHARACTER.spouse,
    type: "spouse_of",
  }),
};

const LINEAGE: FamilyTreeGraphView["lineage"] = [
  {
    childId: CHARACTER.root,
    kind: "biological",
    parentId: CHARACTER.parent,
    relationshipId: EDGE.parent.id,
  },
  {
    childId: CHARACTER.child,
    kind: "biological",
    parentId: CHARACTER.root,
    relationshipId: EDGE.child.id,
  },
];

describe("buildTreeScene", () => {
  it("ranks generations by lineage links only, parents above and children below the root", () => {
    const scene = buildTreeScene({ options: TREE_SCENE.defaultOptions, tree: makeTree() });

    expect(Object.fromEntries(scene.generationById)).toEqual({
      [CHARACTER.child]: 1,
      [CHARACTER.parent]: -1,
      [CHARACTER.root]: 0,
    });
  });

  it("attaches spouse, sibling and guardian as unranked side characters by default", () => {
    const scene = buildTreeScene({ options: TREE_SCENE.defaultOptions, tree: makeTree() });

    expect(scene.edges.map((edge) => edge.id)).toEqual(
      expect.arrayContaining([EDGE.guardian.id, EDGE.sibling.id, EDGE.spouse.id]),
    );
    expect(Object.fromEntries(scene.sideAnchorById)).toEqual({
      [CHARACTER.guardian]: CHARACTER.root,
      [CHARACTER.sibling]: CHARACTER.root,
      [CHARACTER.spouse]: CHARACTER.root,
    });
  });

  it.each<{ edge: CharacterGraphEdgeView; option: TreeOptionKey; relative: string }>([
    { edge: EDGE.spouse, option: "marriages", relative: CHARACTER.spouse },
    { edge: EDGE.sibling, option: "siblings", relative: CHARACTER.sibling },
    { edge: EDGE.guardian, option: "guardians", relative: CHARACTER.guardian },
  ])("hides the $option edge and character while that option is off", (row) => {
    const { edge, option, relative } = row;
    const scene = buildTreeScene({
      options: { ...TREE_SCENE.defaultOptions, [option]: false },
      tree: makeTree(),
    });

    expect(scene.edges.map((shown) => shown.id)).not.toContain(edge.id);
    expect(scene.nodes.map((node) => node.id)).not.toContain(relative);
  });

  it("leaves ex-spouses out by default", () => {
    const scene = buildTreeScene({ options: TREE_SCENE.defaultOptions, tree: makeTree() });

    expect(scene.nodes.map((node) => node.id)).not.toContain(CHARACTER.ex);
  });

  it("shows ex-spouses once ex-unions are switched on", () => {
    const scene = buildTreeScene({
      options: { ...TREE_SCENE.defaultOptions, exUnions: true },
      tree: makeTree(),
    });

    expect(scene.edges.map((edge) => edge.id)).toContain(EDGE.exSpouse.id);
    expect(scene.nodes.map((node) => node.id)).toContain(CHARACTER.ex);
  });

  it("shows a parent edge the server left out of the lineage as an unranked connector", () => {
    const unlisted = makeRelationshipGraphEdge({
      id: "e1e1e1e1-0000-4000-8000-000000000007",
      source: CHARACTER.stranger,
      target: CHARACTER.root,
      type: "biological_parent_of",
    });
    const scene = buildTreeScene({
      options: {
        distant: false,
        exUnions: false,
        guardians: false,
        marriages: false,
        siblings: false,
      },
      tree: makeTree({ edges: [...Object.values(EDGE), unlisted] }),
    });

    expect(scene.roleByEdgeId.get(unlisted.id)).toBe("auxiliary");
    expect(scene.nodes.map((node) => node.id)).toContain(CHARACTER.stranger);
    expect(scene.generationById.has(CHARACTER.stranger)).toBe(false);
  });

  it("treats consistent lineage without diagnostics as regular generations", () => {
    const scene = buildTreeScene({ options: TREE_SCENE.defaultOptions, tree: makeTree() });

    expect(scene.hasIrregularGenerations).toBe(false);
  });

  it("flags irregular generations when the server reports diagnostics", () => {
    const tree = makeTree({
      diagnostics: [
        {
          characterIds: [CHARACTER.root],
          code: "family_cycle_detected",
          message: "Family cycle",
          severity: "warning",
        },
      ],
    });

    const scene = buildTreeScene({ options: TREE_SCENE.defaultOptions, tree });

    expect(scene.hasIrregularGenerations).toBe(true);
  });
});

function makeTree(overrides: Partial<FamilyTreeGraphView> = {}): FamilyTreeGraphView {
  return {
    ancestors: 2,
    descendants: 2,
    diagnostics: [],
    edges: Object.values(EDGE),
    focusCharacterId: CHARACTER.root,
    graphVersion: "tree-v1",
    hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: false },
    lineage: LINEAGE,
    nodes: Object.values(CHARACTER).map((id) => makeRelationshipGraphNode({ id })),
    projection: "family_tree",
    updatedAt: null,
    ...overrides,
  };
}
