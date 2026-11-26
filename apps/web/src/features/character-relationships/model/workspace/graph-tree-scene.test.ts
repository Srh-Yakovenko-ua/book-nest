import type {
  CharacterGraphEdgeView,
  FamilyTreeGraphView,
  FamilyTreeLineageView,
  RelationshipType,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { TreeLineageLink, TreeOptionKey, TreeOptions } from "./graph-tree-scene";

import { makeRelationshipGraphEdge, makeRelationshipGraphNode } from "../relationships.fixtures";
import {
  buildTreeScene,
  countEnabledTreeOptions,
  toTreeGenerations,
  toTreeOptionGroup,
  TREE_SCENE,
} from "./graph-tree-scene";

const CHARACTER = {
  adopter: "a1a1a1a1-0000-4000-8000-000000000009",
  child: "a1a1a1a1-0000-4000-8000-000000000002",
  ex: "a1a1a1a1-0000-4000-8000-000000000003",
  guardian: "a1a1a1a1-0000-4000-8000-000000000004",
  parent: "a1a1a1a1-0000-4000-8000-000000000005",
  parentSpouse: "a1a1a1a1-0000-4000-8000-000000000010",
  root: "a1a1a1a1-0000-4000-8000-000000000001",
  secondParent: "a1a1a1a1-0000-4000-8000-000000000011",
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

const LINK = {
  child: {
    childId: CHARACTER.child,
    kind: "biological",
    parentId: CHARACTER.root,
    relationshipId: EDGE.child.id,
  },
  parent: {
    childId: CHARACTER.root,
    kind: "biological",
    parentId: CHARACTER.parent,
    relationshipId: EDGE.parent.id,
  },
} satisfies Record<string, FamilyTreeLineageView>;

const LINEAGE: FamilyTreeGraphView["lineage"] = [LINK.parent, LINK.child];

const ALL_OPTIONS_OFF: TreeOptions = {
  distant: false,
  exUnions: false,
  guardians: false,
  marriages: false,
  siblings: false,
};

const UNLISTED_PARENT = makeRelationshipGraphEdge({
  id: "e1e1e1e1-0000-4000-8000-000000000007",
  source: CHARACTER.stranger,
  target: CHARACTER.root,
  type: "biological_parent_of",
});

const PEDIGREE = {
  firstParent: "b1b1b1b1-0000-4000-8000-000000000001",
  root: "b1b1b1b1-0000-4000-8000-000000000003",
  secondGrandparent: "b1b1b1b1-0000-4000-8000-000000000004",
  secondParent: "b1b1b1b1-0000-4000-8000-000000000005",
  sharedAncestor: "b1b1b1b1-0000-4000-8000-000000000002",
} as const;

const PEDIGREE_COLLAPSE: TreeLineageLink[] = [
  lineageLink({
    childId: PEDIGREE.root,
    edgeId: "b2b2b2b2-0000-4000-8000-000000000001",
    parentId: PEDIGREE.firstParent,
  }),
  lineageLink({
    childId: PEDIGREE.root,
    edgeId: "b2b2b2b2-0000-4000-8000-000000000002",
    parentId: PEDIGREE.secondParent,
  }),
  lineageLink({
    childId: PEDIGREE.firstParent,
    edgeId: "b2b2b2b2-0000-4000-8000-000000000003",
    parentId: PEDIGREE.sharedAncestor,
  }),
  lineageLink({
    childId: PEDIGREE.secondGrandparent,
    edgeId: "b2b2b2b2-0000-4000-8000-000000000004",
    parentId: PEDIGREE.sharedAncestor,
  }),
  lineageLink({
    childId: PEDIGREE.secondParent,
    edgeId: "b2b2b2b2-0000-4000-8000-000000000005",
    parentId: PEDIGREE.secondGrandparent,
  }),
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

  it("puts a side relative on the row of the character they hang from without a generation", () => {
    const parentMarriage = makeRelationshipGraphEdge({
      directionality: "symmetric",
      id: "e1e1e1e1-0000-4000-8000-000000000008",
      source: CHARACTER.parent,
      target: CHARACTER.parentSpouse,
      type: "spouse_of",
    });
    const scene = buildTreeScene({
      options: TREE_SCENE.defaultOptions,
      tree: makeTree({ edges: [...Object.values(EDGE), parentMarriage] }),
    });

    expect({
      anchor: scene.sideAnchorById.get(CHARACTER.parentSpouse),
      hasGeneration: scene.generationById.has(CHARACTER.parentSpouse),
      row: scene.rowById.get(CHARACTER.parentSpouse),
    }).toEqual({ anchor: CHARACTER.parent, hasGeneration: false, row: -1 });
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

  it("keeps a side relative while another of their relationships is still shown", () => {
    const siblingAsGuardian = makeRelationshipGraphEdge({
      id: "e1e1e1e1-0000-4000-8000-000000000009",
      source: CHARACTER.sibling,
      target: CHARACTER.root,
      type: "guardian_of",
    });
    const scene = buildTreeScene({
      options: { ...TREE_SCENE.defaultOptions, siblings: false },
      tree: makeTree({ edges: [...Object.values(EDGE), siblingAsGuardian] }),
    });

    expect(scene.nodes.map((node) => node.id)).toContain(CHARACTER.sibling);
  });

  it("keeps the lineage edges and every ranked character with every option off", () => {
    const scene = buildTreeScene({ options: ALL_OPTIONS_OFF, tree: makeTree() });

    expect({
      edges: scene.edges.map((edge) => edge.id).sort(),
      nodes: scene.nodes.map((node) => node.id).sort(),
    }).toEqual({
      edges: [EDGE.child.id, EDGE.parent.id],
      nodes: [CHARACTER.root, CHARACTER.child, CHARACTER.parent],
    });
  });

  it("keeps the root when every option hides its only relative", () => {
    const scene = buildTreeScene({
      options: ALL_OPTIONS_OFF,
      tree: makeTree({ edges: [EDGE.spouse], lineage: [] }),
    });

    expect(scene.nodes.map((node) => node.id)).toEqual([CHARACTER.root]);
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

  it("shows a parent edge the server left out of the lineage as an unranked conflict", () => {
    const scene = buildTreeScene({
      options: ALL_OPTIONS_OFF,
      tree: makeTree({ edges: [...Object.values(EDGE), UNLISTED_PARENT] }),
    });

    expect(scene.entryByEdgeId.get(UNLISTED_PARENT.id)?.kind).toBe("conflict");
    expect(scene.nodes.map((node) => node.id)).toContain(CHARACTER.stranger);
    expect(scene.generationById.has(CHARACTER.stranger)).toBe(false);
  });

  it("flags conflicts when a parent edge is missing from the lineage", () => {
    const scene = buildTreeScene({
      options: TREE_SCENE.defaultOptions,
      tree: makeTree({ edges: [...Object.values(EDGE), UNLISTED_PARENT] }),
    });

    expect(scene.hasConflicts).toBe(true);
  });

  it("reports no conflicts for consistent lineage without diagnostics", () => {
    const scene = buildTreeScene({ options: TREE_SCENE.defaultOptions, tree: makeTree() });

    expect(scene.hasConflicts).toBe(false);
  });

  it("keeps the adoptive kind the lineage gives a parent link", () => {
    const adoption = makeRelationshipGraphEdge({
      id: "e1e1e1e1-0000-4000-8000-000000000010",
      source: CHARACTER.adopter,
      target: CHARACTER.root,
      type: "adoptive_parent_of",
    });
    const scene = buildTreeScene({
      options: TREE_SCENE.defaultOptions,
      tree: makeTree({
        edges: [adoption],
        lineage: [
          {
            childId: CHARACTER.root,
            kind: "adoptive",
            parentId: CHARACTER.adopter,
            relationshipId: adoption.id,
          },
        ],
      }),
    });

    expect(scene.entryByEdgeId.get(adoption.id)).toEqual({
      childId: CHARACTER.root,
      edge: adoption,
      kind: "lineage",
      lineageKind: "adoptive",
      parentId: CHARACTER.adopter,
    });
  });

  it("links a child to each of two parents without inventing a bond between the parents", () => {
    const secondParentEdge = makeRelationshipGraphEdge({
      id: "e1e1e1e1-0000-4000-8000-000000000011",
      source: CHARACTER.secondParent,
      target: CHARACTER.root,
      type: "biological_parent_of",
    });
    const scene = buildTreeScene({
      options: TREE_SCENE.defaultOptions,
      tree: makeTree({
        edges: [EDGE.parent, secondParentEdge],
        lineage: [
          LINK.parent,
          {
            childId: CHARACTER.root,
            kind: "biological",
            parentId: CHARACTER.secondParent,
            relationshipId: secondParentEdge.id,
          },
        ],
      }),
    });

    expect(scene.edges.map((edge) => scene.entryByEdgeId.get(edge.id))).toEqual([
      expect.objectContaining({
        childId: CHARACTER.root,
        kind: "lineage",
        parentId: CHARACTER.parent,
      }),
      expect.objectContaining({
        childId: CHARACTER.root,
        kind: "lineage",
        parentId: CHARACTER.secondParent,
      }),
    ]);
  });

  it.each([
    {
      edges: [EDGE.parent],
      label: "a parent",
      lineage: [LINK.parent],
      reach: { ancestors: 1, descendants: 0 },
    },
    {
      edges: [EDGE.child],
      label: "a child",
      lineage: [LINK.child],
      reach: { ancestors: 0, descendants: 1 },
    },
    {
      edges: [EDGE.parent, EDGE.child],
      label: "a parent and a child",
      lineage: LINEAGE,
      reach: { ancestors: 1, descendants: 1 },
    },
  ])("measures the confirmed reach of a tree with only $label", ({ edges, lineage, reach }) => {
    const scene = buildTreeScene({
      options: TREE_SCENE.defaultOptions,
      tree: makeTree({ edges, lineage }),
    });

    expect(scene.reach).toEqual(reach);
  });

  it("reports conflicts when the server reports diagnostics", () => {
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

    expect(scene.hasConflicts).toBe(true);
  });
});

describe("countEnabledTreeOptions", () => {
  it("counts the four relationship groups shown by default", () => {
    expect(countEnabledTreeOptions(TREE_SCENE.defaultOptions)).toBe(4);
  });

  it("counts nothing when every group is off", () => {
    expect(countEnabledTreeOptions(ALL_OPTIONS_OFF)).toBe(0);
  });
});

describe("toTreeOptionGroup", () => {
  it.each<RelationshipType>(["custom", "relative_of", "ancestor_of", "descendant_of"])(
    "files %s under distant relatives",
    (type) => {
      expect(toTreeOptionGroup(type)).toBe("distant");
    },
  );
});

describe("toTreeGenerations", () => {
  it("ranks every parent above its child when one ancestor is reached along two lines", () => {
    const { generationById } = toTreeGenerations({
      lineage: PEDIGREE_COLLAPSE,
      rootId: PEDIGREE.root,
    });
    const misplaced = PEDIGREE_COLLAPSE.filter((link) => {
      const parent = generationById.get(link.parentId);
      const child = generationById.get(link.childId);
      return parent === undefined || child === undefined || child <= parent;
    });

    expect(misplaced).toEqual([]);
  });

  it("keeps the root at generation 0 when one ancestor is reached along two lines", () => {
    const { generationById } = toTreeGenerations({
      lineage: PEDIGREE_COLLAPSE,
      rootId: PEDIGREE.root,
    });

    expect(generationById.get(PEDIGREE.root)).toBe(0);
  });

  it("flags multi-generation links when one ancestor is reached along two lines", () => {
    const { hasMultiLineLinks } = toTreeGenerations({
      lineage: PEDIGREE_COLLAPSE,
      rootId: PEDIGREE.root,
    });

    expect(hasMultiLineLinks).toBe(true);
  });

  it("flags no multi-generation links when no ancestor is reached twice", () => {
    const plain = PEDIGREE_COLLAPSE.filter((link) => link.parentId !== PEDIGREE.sharedAncestor);
    const { hasMultiLineLinks } = toTreeGenerations({ lineage: plain, rootId: PEDIGREE.root });

    expect(hasMultiLineLinks).toBe(false);
  });
});

function lineageLink({
  childId,
  edgeId,
  parentId,
}: Omit<TreeLineageLink, "kind">): TreeLineageLink {
  return { childId, edgeId, kind: "biological", parentId };
}

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
