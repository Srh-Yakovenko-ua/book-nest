import type { BookFamilyTreeView, FamilyTreeLineageView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GenealogyExpansion, GenealogyScene } from "./graph-genealogy-scene";
import type { TreeOptions } from "./graph-tree-scene";

import { makeRelationshipGraphEdge, makeRelationshipGraphNode } from "../relationships.fixtures";
import { buildGenealogyScene, EMPTY_GENEALOGY_EXPANSION } from "./graph-genealogy-scene";
import { TREE_SCENE } from "./graph-tree-scene";

const CHAIN = [
  "a1a1a1a1-0000-4000-8000-000000000001",
  "a1a1a1a1-0000-4000-8000-000000000002",
  "a1a1a1a1-0000-4000-8000-000000000003",
  "a1a1a1a1-0000-4000-8000-000000000004",
  "a1a1a1a1-0000-4000-8000-000000000005",
  "a1a1a1a1-0000-4000-8000-000000000006",
] as const;

const SMALL_FAMILY = {
  child: "a2a2a2a2-0000-4000-8000-000000000002",
  parent: "a2a2a2a2-0000-4000-8000-000000000001",
} as const;

const LARGE_FAMILY = {
  child: "b2b2b2b2-0000-4000-8000-000000000003",
  grandparent: "b2b2b2b2-0000-4000-8000-000000000001",
  parent: "b2b2b2b2-0000-4000-8000-000000000002",
} as const;

const IN_LAW = {
  child: "c3c3c3c3-0000-4000-8000-000000000003",
  founder: "c3c3c3c3-0000-4000-8000-000000000001",
  heir: "c3c3c3c3-0000-4000-8000-000000000002",
  partner: "c3c3c3c3-0000-4000-8000-000000000004",
} as const;

const MARRIAGE = {
  child: "d4d4d4d4-0000-4000-8000-000000000002",
  parent: "d4d4d4d4-0000-4000-8000-000000000001",
  spouse: "d4d4d4d4-0000-4000-8000-000000000003",
} as const;

const BRANCH = {
  coParent: "e5e5e5e5-0000-4000-8000-000000000002",
  firstChild: "e5e5e5e5-0000-4000-8000-000000000003",
  grandchild: "e5e5e5e5-0000-4000-8000-000000000005",
  parent: "e5e5e5e5-0000-4000-8000-000000000001",
  partner: "e5e5e5e5-0000-4000-8000-000000000006",
  partnerParent: "e5e5e5e5-0000-4000-8000-000000000007",
  secondChild: "e5e5e5e5-0000-4000-8000-000000000004",
} as const;

const HOUSE = {
  order: "f6f6f6f6-0000-4000-8000-000000000003",
  stark: "f6f6f6f6-0000-4000-8000-000000000001",
  tully: "f6f6f6f6-0000-4000-8000-000000000002",
} as const;

const HOUSEHOLD = {
  daughter: "a7a7a7a7-0000-4000-8000-000000000003",
  exile: "a7a7a7a7-0000-4000-8000-000000000004",
  firstSon: "b7b7b7b7-0000-4000-8000-000000000002",
  heir: "a7a7a7a7-0000-4000-8000-000000000002",
  lord: "a7a7a7a7-0000-4000-8000-000000000001",
  matriarch: "b7b7b7b7-0000-4000-8000-000000000001",
  secondSon: "b7b7b7b7-0000-4000-8000-000000000003",
  thirdSon: "b7b7b7b7-0000-4000-8000-000000000004",
} as const;

const LOOP = {
  first: "c8c8c8c8-0000-4000-8000-000000000001",
  second: "c8c8c8c8-0000-4000-8000-000000000002",
} as const;

const BRANCH_TREE = makeGenealogy({
  nodes: Object.values(BRANCH).map((id) => makeRelationshipGraphNode({ id })),
  parentOf: [
    [BRANCH.parent, BRANCH.firstChild],
    [BRANCH.coParent, BRANCH.firstChild],
    [BRANCH.parent, BRANCH.secondChild],
    [BRANCH.coParent, BRANCH.secondChild],
    [BRANCH.firstChild, BRANCH.grandchild],
    [BRANCH.partner, BRANCH.grandchild],
    [BRANCH.partnerParent, BRANCH.partner],
  ],
});

const HOUSE_TREE = makeGenealogy({
  houses: [
    { groupType: "house", id: HOUSE.stark, kind: "group", name: "House Stark", size: 2 },
    { groupType: "house", id: HOUSE.tully, kind: "group", name: "House Tully", size: 1 },
  ],
  nodes: [
    makeRelationshipGraphNode({ clusterId: HOUSE.stark, id: HOUSEHOLD.lord }),
    makeRelationshipGraphNode({ clusterId: HOUSE.order, id: HOUSEHOLD.heir }),
    makeRelationshipGraphNode({ id: HOUSEHOLD.daughter }),
    makeRelationshipGraphNode({ clusterId: HOUSE.stark, id: HOUSEHOLD.exile }),
    makeRelationshipGraphNode({ clusterId: HOUSE.tully, id: HOUSEHOLD.matriarch }),
    makeRelationshipGraphNode({ id: HOUSEHOLD.firstSon }),
    makeRelationshipGraphNode({ id: HOUSEHOLD.secondSon }),
    makeRelationshipGraphNode({ id: HOUSEHOLD.thirdSon }),
  ],
  parentOf: [
    [HOUSEHOLD.lord, HOUSEHOLD.heir],
    [HOUSEHOLD.lord, HOUSEHOLD.daughter],
    [HOUSEHOLD.matriarch, HOUSEHOLD.firstSon],
    [HOUSEHOLD.matriarch, HOUSEHOLD.secondSon],
    [HOUSEHOLD.matriarch, HOUSEHOLD.thirdSon],
  ],
});

describe("buildGenealogyScene", () => {
  it("shows every character of a six-generation chain", () => {
    const scene = sceneFor(chainTree());

    expect(shownIds(scene)).toEqual([...CHAIN]);
  });

  it("numbers the generations of a long chain from the top without a generation limit", () => {
    const scene = sceneFor(chainTree());

    expect(Object.fromEntries(scene.generationById)).toEqual({
      [CHAIN[0]]: 0,
      [CHAIN[1]]: 1,
      [CHAIN[2]]: 2,
      [CHAIN[3]]: 3,
      [CHAIN[4]]: 4,
      [CHAIN[5]]: 5,
    });
  });

  it("splits unrelated families into separate components, the larger family first", () => {
    const scene = sceneFor(twoFamiliesTree());

    expect(scene.components.map((component) => component.memberIds)).toEqual([
      [LARGE_FAMILY.grandparent, LARGE_FAMILY.parent, LARGE_FAMILY.child],
      [SMALL_FAMILY.parent, SMALL_FAMILY.child],
    ]);
  });

  it("starts the rows of every family at the top row", () => {
    const scene = sceneFor(twoFamiliesTree());
    const topRows = scene.components.map((component) =>
      Math.min(...component.memberIds.map((id) => scene.rowById.get(id) ?? Number.NaN)),
    );

    expect(topRows).toEqual([0, 0]);
  });

  it("pulls a partner without parents down to the row just above the shared child", () => {
    const scene = sceneFor(
      makeGenealogy({
        nodes: Object.values(IN_LAW).map((id) => makeRelationshipGraphNode({ id })),
        parentOf: [
          [IN_LAW.founder, IN_LAW.heir],
          [IN_LAW.heir, IN_LAW.child],
          [IN_LAW.partner, IN_LAW.child],
        ],
      }),
    );

    expect({
      heir: scene.rowById.get(IN_LAW.heir),
      partner: scene.rowById.get(IN_LAW.partner),
    }).toEqual({ heir: 1, partner: 1 });
  });

  it("shows a spouse without parents or children on the partner's row beside the partner", () => {
    const scene = sceneFor(marriageTree());

    expect({
      anchor: scene.sideAnchorById.get(MARRIAGE.spouse),
      row: scene.rowById.get(MARRIAGE.spouse),
    }).toEqual({ anchor: MARRIAGE.child, row: 1 });
  });

  it("hides that spouse while marriages are switched off", () => {
    const scene = sceneFor(marriageTree(), {
      options: { ...TREE_SCENE.defaultOptions, marriages: false },
    });

    expect(shownIds(scene)).toEqual([MARRIAGE.child, MARRIAGE.parent]);
  });

  it("hides the children a collapsed parent shares with the co-parent", () => {
    const shown = shownIds(sceneFor(BRANCH_TREE, { expansion: collapsing(BRANCH.parent) }));

    expect(shown).not.toContain(BRANCH.firstChild);
    expect(shown).not.toContain(BRANCH.secondChild);
  });

  it("keeps a grandchild whose other parent's branch is still shown", () => {
    const shown = shownIds(sceneFor(BRANCH_TREE, { expansion: collapsing(BRANCH.parent) }));

    expect(shown).toContain(BRANCH.grandchild);
  });

  it("keeps the collapsed parent and the co-parent on the map", () => {
    const shown = shownIds(sceneFor(BRANCH_TREE, { expansion: collapsing(BRANCH.parent) }));

    expect(shown).toEqual(expect.arrayContaining([BRANCH.parent, BRANCH.coParent]));
  });

  it("counts only the descendants the collapse actually hides", () => {
    const scene = sceneFor(BRANCH_TREE, { expansion: collapsing(BRANCH.parent) });

    expect(scene.hiddenDescendantsById.get(BRANCH.parent)).toBe(2);
  });

  it("ignores a collapsed character who has no children", () => {
    const scene = sceneFor(BRANCH_TREE, {
      expansion: collapsing(BRANCH.parent, BRANCH.grandchild),
    });

    expect(scene.collapsedIds).toEqual(new Set([BRANCH.parent]));
  });

  it("assigns a house only to characters whose group is one of the book's houses", () => {
    const scene = sceneFor(HOUSE_TREE);

    expect({
      heir: scene.houseIdById.get(HOUSEHOLD.heir),
      lord: scene.houseIdById.get(HOUSEHOLD.lord),
    }).toEqual({ heir: undefined, lord: HOUSE.stark });
  });

  it("lists only the shown members of each house", () => {
    const scene = sceneFor(HOUSE_TREE);

    expect(scene.houses.map((house) => [house.id, house.memberIds])).toEqual([
      [HOUSE.stark, [HOUSEHOLD.lord]],
      [HOUSE.tully, [HOUSEHOLD.matriarch]],
    ]);
  });

  it("gives a family the house that a third of its members share", () => {
    const scene = sceneFor(HOUSE_TREE);

    expect(componentOf(scene, HOUSEHOLD.lord)?.houseId).toBe(HOUSE.stark);
  });

  it("gives a family no house when no house reaches a third of its members", () => {
    const scene = sceneFor(HOUSE_TREE);

    expect(componentOf(scene, HOUSEHOLD.matriarch)?.houseId).toBeNull();
  });

  it("returns a scene for a lineage cycle instead of hanging", () => {
    const scene = sceneFor(
      makeGenealogy({
        nodes: Object.values(LOOP).map((id) => makeRelationshipGraphNode({ id })),
        parentOf: [
          [LOOP.first, LOOP.second],
          [LOOP.second, LOOP.first],
        ],
      }),
    );

    expect(shownIds(scene)).toEqual([LOOP.first, LOOP.second]);
  });
});

function chainTree(): BookFamilyTreeView {
  return makeGenealogy({
    nodes: CHAIN.map((id) => makeRelationshipGraphNode({ id })),
    parentOf: [
      [CHAIN[0], CHAIN[1]],
      [CHAIN[1], CHAIN[2]],
      [CHAIN[2], CHAIN[3]],
      [CHAIN[3], CHAIN[4]],
      [CHAIN[4], CHAIN[5]],
    ],
  });
}

function collapsing(...ids: string[]): GenealogyExpansion {
  return { collapsedIds: new Set(ids) };
}

function componentOf(scene: GenealogyScene, memberId: string) {
  return scene.components.find((component) => component.memberIds.includes(memberId));
}

function makeGenealogy({
  houses = [],
  nodes,
  parentOf,
  spouseOf = [],
}: {
  houses?: BookFamilyTreeView["houses"];
  nodes: BookFamilyTreeView["nodes"];
  parentOf: readonly (readonly [string, string])[];
  spouseOf?: readonly (readonly [string, string])[];
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
    houses,
    lineage: parentEdges.map((edge): FamilyTreeLineageView => ({
      childId: edge.target,
      kind: "biological",
      parentId: edge.source,
      relationshipId: edge.id,
    })),
    nodes,
    scope: "book",
    updatedAt: null,
  };
}

function marriageTree(): BookFamilyTreeView {
  return makeGenealogy({
    nodes: Object.values(MARRIAGE).map((id) => makeRelationshipGraphNode({ id })),
    parentOf: [[MARRIAGE.parent, MARRIAGE.child]],
    spouseOf: [[MARRIAGE.child, MARRIAGE.spouse]],
  });
}

function sceneFor(
  tree: BookFamilyTreeView,
  {
    expansion = EMPTY_GENEALOGY_EXPANSION,
    options = TREE_SCENE.defaultOptions,
  }: { expansion?: GenealogyExpansion; options?: TreeOptions } = {},
): GenealogyScene {
  return buildGenealogyScene({ expansion, options, tree });
}

function shownIds(scene: GenealogyScene): string[] {
  return scene.nodes.map((node) => node.id);
}

function toEdgeId(prefix: string, index: number): string {
  return `${prefix}-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
}

function twoFamiliesTree(): BookFamilyTreeView {
  return makeGenealogy({
    nodes: [...Object.values(SMALL_FAMILY), ...Object.values(LARGE_FAMILY)].map((id) =>
      makeRelationshipGraphNode({ id }),
    ),
    parentOf: [
      [SMALL_FAMILY.parent, SMALL_FAMILY.child],
      [LARGE_FAMILY.grandparent, LARGE_FAMILY.parent],
      [LARGE_FAMILY.parent, LARGE_FAMILY.child],
    ],
  });
}
