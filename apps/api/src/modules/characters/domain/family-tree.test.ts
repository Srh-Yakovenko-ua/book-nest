import type {
  FamilyTreeLineageKind,
  FamilyTreeLineageView,
  Nullable,
  RelationshipCategory,
  RelationshipDirectionality,
  RelationshipType,
} from "@app/shared";

import { CHARACTER_RELATIONSHIP_ERROR_CODES } from "@app/shared";
import { describe, expect, it } from "vitest";

import type { GraphEdgeSource, GraphNodeAppearance, GraphNodeSource } from "./character-graph.js";
import type { RelationshipBookStateSource } from "./character-relationship.mapper.js";
import type { ReaderBook, RelationshipReaderContext } from "./relationship-reader-projection.js";

import { buildFamilyTreeGraph } from "./family-tree.js";

const BOOK = "20000000-0000-4000-8000-000000000001";

const CHARACTER = {
  child: "55555555-5555-4555-8555-555555555555",
  coParent: "88888888-8888-4888-8888-888888888888",
  grandchild: "66666666-6666-4666-8666-666666666666",
  grandparent: "33333333-3333-4333-8333-333333333333",
  greatGrandparent: "44444444-4444-4444-8444-444444444444",
  inLaw: "99999999-9999-4999-8999-999999999999",
  kin: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  parent: "22222222-2222-4222-8222-222222222222",
  root: "11111111-1111-4111-8111-111111111111",
  spouse: "77777777-7777-4777-8777-777777777777",
  stranger: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
} as const;

const LINEAGE_CASES: {
  childId: string;
  kind: FamilyTreeLineageKind;
  parentId: string;
  type: RelationshipType;
}[] = [
  {
    childId: CHARACTER.kin,
    kind: "biological",
    parentId: CHARACTER.root,
    type: "biological_parent_of",
  },
  {
    childId: CHARACTER.kin,
    kind: "adoptive",
    parentId: CHARACTER.root,
    type: "adoptive_parent_of",
  },
  { childId: CHARACTER.kin, kind: "step", parentId: CHARACTER.root, type: "step_parent_of" },
  {
    childId: CHARACTER.root,
    kind: "biological",
    parentId: CHARACTER.kin,
    type: "biological_child_of",
  },
  { childId: CHARACTER.root, kind: "adoptive", parentId: CHARACTER.kin, type: "adoptive_child_of" },
  { childId: CHARACTER.root, kind: "step", parentId: CHARACTER.kin, type: "step_child_of" },
];

const SIDE_RELATION_CASES: {
  customType: Nullable<string>;
  directionality: RelationshipDirectionality;
  type: RelationshipType;
}[] = [
  { customType: null, directionality: "directed", type: "guardian_of" },
  { customType: null, directionality: "directed", type: "ward_of" },
  { customType: null, directionality: "directed", type: "ancestor_of" },
  { customType: null, directionality: "directed", type: "descendant_of" },
  { customType: null, directionality: "symmetric", type: "sibling_of" },
  { customType: null, directionality: "symmetric", type: "half_sibling_of" },
  { customType: null, directionality: "symmetric", type: "step_sibling_of" },
  { customType: null, directionality: "symmetric", type: "twin_of" },
  { customType: null, directionality: "symmetric", type: "spouse_of" },
  { customType: null, directionality: "symmetric", type: "ex_spouse_of" },
  { customType: null, directionality: "symmetric", type: "relative_of" },
  { customType: "sworn kin", directionality: "symmetric", type: "custom" },
];

const OUTSIDE_FAMILY_CASES: {
  category: RelationshipCategory;
  directionality: RelationshipDirectionality;
  type: RelationshipType;
}[] = [
  { category: "romantic", directionality: "symmetric", type: "partner_of" },
  { category: "romantic", directionality: "symmetric", type: "ex_partner_of" },
  { category: "romantic", directionality: "symmetric", type: "engaged_to" },
  { category: "social", directionality: "symmetric", type: "friend_of" },
  { category: "conflict", directionality: "symmetric", type: "enemy_of" },
  { category: "mentorship", directionality: "directed", type: "mentor_of" },
];

const HIDDEN_STATE_CASES: { reason: string; state: Partial<RelationshipBookStateSource> }[] = [
  { reason: "type is a spoiler", state: { isTypeSpoiler: true } },
  { reason: "relationship is hidden as a spoiler", state: { hideRelationshipAsSpoiler: true } },
];

function appearanceSource(): GraphNodeAppearance {
  return {
    bookId: BOOK,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    displayName: null,
    displayNameIsSpoiler: false,
    importance: "major",
    portrait: null,
    portraitIsSpoiler: false,
    portraitMediaId: null,
  };
}

function buildTree({
  ancestors = 2,
  descendants = 2,
  edgeLimit = 600,
  edges = [],
  nodeLimit = 300,
  nodes = Object.values(CHARACTER).map((id) => nodeSource(id)),
}: {
  ancestors?: number;
  descendants?: number;
  edgeLimit?: number;
  edges?: GraphEdgeSource[];
  nodeLimit?: number;
  nodes?: GraphNodeSource[];
}) {
  return buildFamilyTreeGraph({
    ancestors,
    descendants,
    edgeLimit,
    edges,
    focusCharacterId: CHARACTER.root,
    nodeLimit,
    nodes,
    partNumberById: new Map<string, Nullable<number>>(),
    readerContext: readerContext(),
  });
}

function idsOf(items: { id: string }[]): string[] {
  return items.map((item) => item.id).sort();
}

function lineageIdsOf(lineage: FamilyTreeLineageView[]): string[] {
  return lineage.map((link) => link.relationshipId).sort();
}

function nodeSource(id: string): GraphNodeSource {
  return {
    appearances: [appearanceSource()],
    avatar: null,
    entityKind: "individual",
    id,
    isFavorite: false,
    name: id,
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  };
}

function readerContext(): RelationshipReaderContext {
  const book: ReaderBook = {
    id: BOOK,
    partNumber: null,
    position: { kind: "unknown" },
    seriesId: null,
    title: "Book",
  };
  return {
    books: new Map([[BOOK, book]]),
    scope: { contextBookId: BOOK, kind: "as_of" },
  };
}

function relation({
  category = "family",
  customType = null,
  directionality = "directed",
  index,
  source,
  state = {},
  target,
  type,
}: {
  category?: RelationshipCategory;
  customType?: Nullable<string>;
  directionality?: RelationshipDirectionality;
  index: number;
  source: string;
  state?: Partial<RelationshipBookStateSource>;
  target: string;
  type: RelationshipType;
}): GraphEdgeSource {
  return {
    bookStates: [stateSource({ index, overrides: state })],
    category,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    customType,
    directionality,
    id: relationshipId(index),
    isCanonical: true,
    sourceCharacterId: source,
    sourceLabel: null,
    targetCharacterId: target,
    targetLabel: null,
    type,
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
  };
}

function relationshipId(index: number): string {
  return `0000000a-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function stateSource({
  index,
  overrides,
}: {
  index: number;
  overrides: Partial<RelationshipBookStateSource>;
}): RelationshipBookStateSource {
  return {
    bookId: BOOK,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    description: null,
    endedAudioSeconds: null,
    endedChapter: null,
    endedPage: null,
    hideRelationshipAsSpoiler: false,
    id: `0000000b-0000-4000-8000-${String(index).padStart(12, "0")}`,
    intensity: null,
    introducedAudioSeconds: null,
    introducedChapter: null,
    introducedPage: null,
    isDescriptionSpoiler: false,
    isTypeSpoiler: false,
    relationshipId: relationshipId(index),
    status: "active",
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("buildFamilyTreeGraph", () => {
  describe("lineage types", () => {
    it.each(LINEAGE_CASES)(
      "reads $type from the root to its relative as a $kind parent and child link",
      ({ childId, kind, parentId, type }) => {
        const tree = buildTree({
          edges: [relation({ index: 1, source: CHARACTER.root, target: CHARACTER.kin, type })],
        });

        expect(tree.lineage).toEqual([
          { childId, kind, parentId, relationshipId: relationshipId(1) },
        ]);
      },
    );

    it("lists every lineage link among the edges and both of its people among the nodes", () => {
      const tree = buildTree({
        edges: [
          relation({
            index: 1,
            source: CHARACTER.parent,
            target: CHARACTER.root,
            type: "biological_parent_of",
          }),
          relation({
            index: 2,
            source: CHARACTER.parent,
            target: CHARACTER.grandparent,
            type: "adoptive_child_of",
          }),
          relation({
            index: 3,
            source: CHARACTER.root,
            target: CHARACTER.child,
            type: "step_parent_of",
          }),
          relation({
            index: 4,
            source: CHARACTER.child,
            target: CHARACTER.coParent,
            type: "biological_child_of",
          }),
          relation({
            directionality: "symmetric",
            index: 5,
            source: CHARACTER.root,
            target: CHARACTER.spouse,
            type: "spouse_of",
          }),
        ],
      });

      const edgeIds = new Set(tree.edges.map((edge) => edge.id));
      const nodeIds = new Set(tree.nodes.map((node) => node.id));
      expect(tree.lineage).toHaveLength(4);
      for (const link of tree.lineage) {
        expect(edgeIds.has(link.relationshipId)).toBe(true);
        expect(nodeIds.has(link.parentId)).toBe(true);
        expect(nodeIds.has(link.childId)).toBe(true);
      }
    });
  });

  describe("side relations", () => {
    it.each(SIDE_RELATION_CASES)(
      "shows $type as an edge to its other person without making it lineage",
      ({ customType, directionality, type }) => {
        const tree = buildTree({
          edges: [
            relation({
              customType,
              directionality,
              index: 1,
              source: CHARACTER.root,
              target: CHARACTER.kin,
              type,
            }),
          ],
        });

        expect(tree.lineage).toEqual([]);
        expect(tree.edges.map((edge) => edge.id)).toEqual([relationshipId(1)]);
        expect(idsOf(tree.nodes)).toEqual([CHARACTER.root, CHARACTER.kin].sort());
      },
    );

    it("adds the side relative of a ranked ancestor, not only of the root", () => {
      const tree = buildTree({
        edges: [
          relation({
            index: 1,
            source: CHARACTER.parent,
            target: CHARACTER.root,
            type: "biological_parent_of",
          }),
          relation({
            directionality: "symmetric",
            index: 2,
            source: CHARACTER.parent,
            target: CHARACTER.kin,
            type: "sibling_of",
          }),
        ],
      });

      expect(idsOf(tree.nodes)).toEqual([CHARACTER.root, CHARACTER.parent, CHARACTER.kin].sort());
      expect(idsOf(tree.edges)).toEqual([relationshipId(1), relationshipId(2)]);
      expect(lineageIdsOf(tree.lineage)).toEqual([relationshipId(1)]);
    });

    it("does not expand the family of a person reached only through a side relation", () => {
      const tree = buildTree({
        edges: [
          relation({
            directionality: "symmetric",
            index: 1,
            source: CHARACTER.root,
            target: CHARACTER.spouse,
            type: "spouse_of",
          }),
          relation({
            index: 2,
            source: CHARACTER.spouse,
            target: CHARACTER.kin,
            type: "biological_parent_of",
          }),
          relation({
            directionality: "symmetric",
            index: 3,
            source: CHARACTER.spouse,
            target: CHARACTER.inLaw,
            type: "sibling_of",
          }),
        ],
      });

      expect(idsOf(tree.nodes)).toEqual([CHARACTER.root, CHARACTER.spouse].sort());
      expect(idsOf(tree.edges)).toEqual([relationshipId(1)]);
      expect(tree.lineage).toEqual([]);
    });

    it.each(OUTSIDE_FAMILY_CASES)(
      "leaves out a $category $type relationship entirely",
      ({ category, directionality, type }) => {
        const tree = buildTree({
          edges: [
            relation({
              category,
              directionality,
              index: 1,
              source: CHARACTER.root,
              target: CHARACTER.kin,
              type,
            }),
          ],
        });

        expect(idsOf(tree.nodes)).toEqual([CHARACTER.root]);
        expect(tree.edges).toEqual([]);
        expect(tree.lineage).toEqual([]);
      },
    );
  });

  describe("generations", () => {
    it("bounds the ancestors so a great-grandparent stays out at two generations", () => {
      const tree = buildTree({
        ancestors: 2,
        edges: [
          relation({
            index: 1,
            source: CHARACTER.parent,
            target: CHARACTER.root,
            type: "biological_parent_of",
          }),
          relation({
            index: 2,
            source: CHARACTER.grandparent,
            target: CHARACTER.parent,
            type: "biological_parent_of",
          }),
          relation({
            index: 3,
            source: CHARACTER.greatGrandparent,
            target: CHARACTER.grandparent,
            type: "biological_parent_of",
          }),
        ],
      });

      expect(idsOf(tree.nodes)).toEqual(
        [CHARACTER.root, CHARACTER.parent, CHARACTER.grandparent].sort(),
      );
      expect(lineageIdsOf(tree.lineage)).toEqual([relationshipId(1), relationshipId(2)]);
    });

    it("bounds the descendants independently of the ancestors", () => {
      const tree = buildTree({
        ancestors: 1,
        descendants: 2,
        edges: [
          relation({
            index: 1,
            source: CHARACTER.parent,
            target: CHARACTER.root,
            type: "biological_parent_of",
          }),
          relation({
            index: 2,
            source: CHARACTER.grandparent,
            target: CHARACTER.parent,
            type: "biological_parent_of",
          }),
          relation({
            index: 3,
            source: CHARACTER.root,
            target: CHARACTER.child,
            type: "biological_parent_of",
          }),
          relation({
            index: 4,
            source: CHARACTER.child,
            target: CHARACTER.grandchild,
            type: "biological_parent_of",
          }),
        ],
      });

      expect(idsOf(tree.nodes)).toEqual(
        [CHARACTER.parent, CHARACTER.root, CHARACTER.child, CHARACTER.grandchild].sort(),
      );
    });

    it("includes the other parent of an included child", () => {
      const tree = buildTree({
        ancestors: 1,
        descendants: 1,
        edges: [
          relation({
            index: 1,
            source: CHARACTER.root,
            target: CHARACTER.child,
            type: "biological_parent_of",
          }),
          relation({
            index: 2,
            source: CHARACTER.coParent,
            target: CHARACTER.child,
            type: "biological_parent_of",
          }),
        ],
      });

      expect(idsOf(tree.nodes)).toEqual(
        [CHARACTER.root, CHARACTER.child, CHARACTER.coParent].sort(),
      );
      expect(lineageIdsOf(tree.lineage)).toEqual([relationshipId(1), relationshipId(2)]);
    });

    it("does not climb from a co-parent to the co-parent's own parents", () => {
      const tree = buildTree({
        ancestors: 2,
        descendants: 2,
        edges: [
          relation({
            index: 1,
            source: CHARACTER.root,
            target: CHARACTER.child,
            type: "biological_parent_of",
          }),
          relation({
            index: 2,
            source: CHARACTER.coParent,
            target: CHARACTER.child,
            type: "biological_parent_of",
          }),
          relation({
            index: 3,
            source: CHARACTER.inLaw,
            target: CHARACTER.coParent,
            type: "biological_parent_of",
          }),
        ],
      });

      expect(tree.nodes.some((node) => node.id === CHARACTER.inLaw)).toBe(false);
      expect(tree.edges.some((edge) => edge.id === relationshipId(3))).toBe(false);
    });
  });

  describe("sparse roots", () => {
    it("returns the root alone when it has no family relationships", () => {
      const tree = buildTree({
        edges: [
          relation({
            index: 1,
            source: CHARACTER.stranger,
            target: CHARACTER.kin,
            type: "biological_parent_of",
          }),
        ],
      });

      expect(tree.nodes.map((node) => node.id)).toEqual([CHARACTER.root]);
      expect(tree.edges).toEqual([]);
      expect(tree.lineage).toEqual([]);
    });

    it("returns the root and its spouse with no lineage when a spouse is the only relation", () => {
      const tree = buildTree({
        edges: [
          relation({
            directionality: "symmetric",
            index: 1,
            source: CHARACTER.root,
            target: CHARACTER.spouse,
            type: "spouse_of",
          }),
        ],
      });

      expect(idsOf(tree.nodes)).toEqual([CHARACTER.root, CHARACTER.spouse].sort());
      expect(tree.lineage).toEqual([]);
    });
  });

  describe("spoilers", () => {
    it.each(HIDDEN_STATE_CASES)(
      "leaves out a lineage or side relationship whose $reason",
      ({ state }) => {
        const tree = buildTree({
          edges: [
            relation({
              index: 1,
              source: CHARACTER.parent,
              state,
              target: CHARACTER.root,
              type: "biological_parent_of",
            }),
            relation({
              directionality: "symmetric",
              index: 2,
              source: CHARACTER.root,
              state,
              target: CHARACTER.spouse,
              type: "spouse_of",
            }),
          ],
        });

        expect(tree.nodes.map((node) => node.id)).toEqual([CHARACTER.root]);
        expect(tree.edges).toEqual([]);
        expect(tree.lineage).toEqual([]);
      },
    );
  });

  describe("cycles", () => {
    const cyclicEdges = [
      relation({
        index: 1,
        source: CHARACTER.root,
        target: CHARACTER.kin,
        type: "biological_parent_of",
      }),
      relation({
        index: 2,
        source: CHARACTER.kin,
        target: CHARACTER.root,
        type: "biological_parent_of",
      }),
      relation({
        index: 3,
        source: CHARACTER.root,
        target: CHARACTER.child,
        type: "biological_parent_of",
      }),
    ];

    it("reports a parent and child cycle as a family cycle diagnostic", () => {
      const tree = buildTree({ edges: cyclicEdges });

      expect(tree.diagnostics).toHaveLength(1);
      expect(tree.diagnostics[0]?.code).toBe(
        CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected,
      );
      expect([...(tree.diagnostics[0]?.characterIds ?? [])].sort()).toEqual(
        [CHARACTER.root, CHARACTER.kin].sort(),
      );
    });

    it("drops the cycle links from lineage while keeping them as edges", () => {
      const tree = buildTree({ edges: cyclicEdges });

      expect(lineageIdsOf(tree.lineage)).toEqual([relationshipId(3)]);
      expect(idsOf(tree.edges)).toEqual([relationshipId(1), relationshipId(2), relationshipId(3)]);
    });
  });

  describe("node limit", () => {
    const fiveGenerationEdges = [
      relation({
        index: 1,
        source: CHARACTER.parent,
        target: CHARACTER.root,
        type: "biological_parent_of",
      }),
      relation({
        index: 2,
        source: CHARACTER.grandparent,
        target: CHARACTER.parent,
        type: "biological_parent_of",
      }),
      relation({
        index: 3,
        source: CHARACTER.root,
        target: CHARACTER.child,
        type: "biological_parent_of",
      }),
      relation({
        index: 4,
        source: CHARACTER.child,
        target: CHARACTER.grandchild,
        type: "biological_parent_of",
      }),
    ];

    it("keeps the root and the nearest generations first and flags the truncation", () => {
      const tree = buildTree({ edges: fiveGenerationEdges, nodeLimit: 3 });

      expect(idsOf(tree.nodes)).toEqual([CHARACTER.root, CHARACTER.parent, CHARACTER.child].sort());
      expect(lineageIdsOf(tree.lineage)).toEqual([relationshipId(1), relationshipId(3)]);
      expect(tree.hiddenContent.truncated).toBe(true);
    });

    it("does not flag truncation when every generation fits", () => {
      const tree = buildTree({ edges: fiveGenerationEdges });

      expect(tree.nodes).toHaveLength(5);
      expect(tree.hiddenContent.truncated).toBe(false);
    });
  });
});
