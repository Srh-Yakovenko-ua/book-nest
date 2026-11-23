import type {
  CharacterGroupType,
  FamilyTreeLineageView,
  Nullable,
  RelationshipCategory,
  RelationshipDirectionality,
  RelationshipType,
} from "@app/shared";

import { CHARACTER_RELATIONSHIP_ERROR_CODES } from "@app/shared";
import { describe, expect, it } from "vitest";

import type {
  GraphEdgeSource,
  GraphMembershipGroup,
  GraphMembershipSource,
  GraphNodeAppearance,
  GraphNodeSource,
} from "./character-graph.js";
import type { RelationshipBookStateSource } from "./character-relationship.mapper.js";
import type { ReaderBook, RelationshipReaderContext } from "./relationship-reader-projection.js";

import { buildBookFamilyTree } from "./book-family-tree.js";

const BOOK = "20000000-0000-4000-8000-000000000001";

const PERSON = {
  child: "c0000000-0000-4000-8000-000000000052",
  eastChild: "c0000000-0000-4000-8000-000000000042",
  eastParent: "c0000000-0000-4000-8000-000000000041",
  generation1: "c0000000-0000-4000-8000-000000000001",
  generation2: "c0000000-0000-4000-8000-000000000002",
  generation3: "c0000000-0000-4000-8000-000000000003",
  generation4: "c0000000-0000-4000-8000-000000000004",
  generation5: "c0000000-0000-4000-8000-000000000005",
  generation6: "c0000000-0000-4000-8000-000000000006",
  grandchild: "c0000000-0000-4000-8000-000000000053",
  hiddenChild: "c0000000-0000-4000-8000-000000000056",
  hiddenSpouse: "c0000000-0000-4000-8000-000000000057",
  large1: "c0000000-0000-4000-8000-000000000031",
  large2: "c0000000-0000-4000-8000-000000000032",
  large3: "c0000000-0000-4000-8000-000000000033",
  large4: "c0000000-0000-4000-8000-000000000034",
  middle1: "c0000000-0000-4000-8000-000000000021",
  middle2: "c0000000-0000-4000-8000-000000000022",
  middle3: "c0000000-0000-4000-8000-000000000023",
  outsider: "c0000000-0000-4000-8000-000000000055",
  parent: "c0000000-0000-4000-8000-000000000051",
  partner: "c0000000-0000-4000-8000-000000000054",
  small1: "c0000000-0000-4000-8000-000000000011",
  small2: "c0000000-0000-4000-8000-000000000012",
  westChild: "c0000000-0000-4000-8000-000000000044",
  westParent: "c0000000-0000-4000-8000-000000000043",
} as const;

const AUXILIARY_CASES: {
  customType: Nullable<string>;
  directionality: RelationshipDirectionality;
  type: RelationshipType;
}[] = [
  { customType: null, directionality: "symmetric", type: "spouse_of" },
  { customType: null, directionality: "symmetric", type: "ex_spouse_of" },
  { customType: null, directionality: "symmetric", type: "sibling_of" },
  { customType: null, directionality: "symmetric", type: "half_sibling_of" },
  { customType: null, directionality: "symmetric", type: "step_sibling_of" },
  { customType: null, directionality: "symmetric", type: "twin_of" },
  { customType: null, directionality: "directed", type: "guardian_of" },
  { customType: null, directionality: "directed", type: "ward_of" },
  { customType: null, directionality: "directed", type: "ancestor_of" },
  { customType: null, directionality: "directed", type: "descendant_of" },
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

const HOUSE_GROUP_TYPES: CharacterGroupType[] = ["house", "family", "clan"];

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

function buildBookTree({
  edgeLimit = 600,
  edges,
  memberships = [],
  nodeLimit = 300,
}: {
  edgeLimit?: number;
  edges: GraphEdgeSource[];
  memberships?: GraphMembershipSource[];
  nodeLimit?: number;
}) {
  return buildBookFamilyTree({
    allowedBookIds: new Set([BOOK]),
    edgeLimit,
    edges,
    memberships,
    nodeLimit,
    nodes: nodesReferencedBy(edges),
    partNumberById: new Map<string, Nullable<number>>(),
    readerContext: readerContext(),
  });
}

function clusterOf({
  id,
  nodes,
}: {
  id: string;
  nodes: { clusterId: Nullable<string>; id: string }[];
}): Nullable<string> | undefined {
  return nodes.find((node) => node.id === id)?.clusterId;
}

function group({
  isSpoiler = false,
  type,
}: {
  isSpoiler?: boolean;
  type: CharacterGroupType;
}): GraphMembershipGroup {
  return { id: groupId(1), isSpoiler, name: "Stark", type };
}

function groupId(index: number): string {
  return `0000000c-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

function idsOf(items: { id: string }[]): string[] {
  return items.map((item) => item.id).sort();
}

function lineageIdsOf(lineage: FamilyTreeLineageView[]): string[] {
  return lineage.map((link) => link.relationshipId).sort();
}

function membership({
  characterId,
  isSpoiler = false,
  membershipGroup,
}: {
  characterId: string;
  isSpoiler?: boolean;
  membershipGroup: GraphMembershipGroup;
}): GraphMembershipSource {
  return { bookId: BOOK, characterId, group: membershipGroup, isSpoiler };
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

function nodesReferencedBy(edges: GraphEdgeSource[]): GraphNodeSource[] {
  const ids = new Set(edges.flatMap((edge) => [edge.sourceCharacterId, edge.targetCharacterId]));
  return [...ids].map((id) => nodeSource(id));
}

function parentOf({
  child,
  index,
  parent,
}: {
  child: string;
  index: number;
  parent: string;
}): GraphEdgeSource {
  return relation({ index, source: parent, target: child, type: "biological_parent_of" });
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

function sortedLineage(lineage: FamilyTreeLineageView[]): FamilyTreeLineageView[] {
  return [...lineage].sort((left, right) =>
    left.relationshipId.localeCompare(right.relationshipId),
  );
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

describe("buildBookFamilyTree", () => {
  describe("whole genealogy", () => {
    const sixGenerationEdges = [
      parentOf({ child: PERSON.generation2, index: 1, parent: PERSON.generation1 }),
      parentOf({ child: PERSON.generation3, index: 2, parent: PERSON.generation2 }),
      parentOf({ child: PERSON.generation4, index: 3, parent: PERSON.generation3 }),
      parentOf({ child: PERSON.generation5, index: 4, parent: PERSON.generation4 }),
      parentOf({ child: PERSON.generation6, index: 5, parent: PERSON.generation5 }),
    ];

    it("returns every person of a six-generation line with no generation limit", () => {
      const tree = buildBookTree({ edges: sixGenerationEdges });

      expect(idsOf(tree.nodes)).toEqual(
        [
          PERSON.generation1,
          PERSON.generation2,
          PERSON.generation3,
          PERSON.generation4,
          PERSON.generation5,
          PERSON.generation6,
        ].sort(),
      );
    });

    it("lists every parent and child link of a six-generation line as biological lineage", () => {
      const tree = buildBookTree({ edges: sixGenerationEdges });

      expect(sortedLineage(tree.lineage)).toEqual([
        {
          childId: PERSON.generation2,
          kind: "biological",
          parentId: PERSON.generation1,
          relationshipId: relationshipId(1),
        },
        {
          childId: PERSON.generation3,
          kind: "biological",
          parentId: PERSON.generation2,
          relationshipId: relationshipId(2),
        },
        {
          childId: PERSON.generation4,
          kind: "biological",
          parentId: PERSON.generation3,
          relationshipId: relationshipId(3),
        },
        {
          childId: PERSON.generation5,
          kind: "biological",
          parentId: PERSON.generation4,
          relationshipId: relationshipId(4),
        },
        {
          childId: PERSON.generation6,
          kind: "biological",
          parentId: PERSON.generation5,
          relationshipId: relationshipId(5),
        },
      ]);
    });
  });

  describe("independent families", () => {
    const twoFamilyEdges = [
      parentOf({ child: PERSON.westChild, index: 1, parent: PERSON.westParent }),
      parentOf({ child: PERSON.eastChild, index: 2, parent: PERSON.eastParent }),
    ];

    it("returns the members of two families that share no relationship", () => {
      const tree = buildBookTree({ edges: twoFamilyEdges });

      expect(idsOf(tree.nodes)).toEqual(
        [PERSON.westParent, PERSON.westChild, PERSON.eastParent, PERSON.eastChild].sort(),
      );
    });

    it("adds no edge between two unrelated families", () => {
      const tree = buildBookTree({ edges: twoFamilyEdges });

      expect(idsOf(tree.edges)).toEqual([relationshipId(1), relationshipId(2)]);
    });

    it("adds no lineage link between two unrelated families", () => {
      const tree = buildBookTree({ edges: twoFamilyEdges });

      expect(sortedLineage(tree.lineage)).toEqual([
        {
          childId: PERSON.westChild,
          kind: "biological",
          parentId: PERSON.westParent,
          relationshipId: relationshipId(1),
        },
        {
          childId: PERSON.eastChild,
          kind: "biological",
          parentId: PERSON.eastParent,
          relationshipId: relationshipId(2),
        },
      ]);
    });
  });

  describe("auxiliary family relations", () => {
    it.each(AUXILIARY_CASES)(
      "keeps a $type relative with no parents or children together with that edge",
      ({ customType, directionality, type }) => {
        const tree = buildBookTree({
          edges: [
            parentOf({ child: PERSON.child, index: 1, parent: PERSON.parent }),
            relation({
              customType,
              directionality,
              index: 2,
              source: PERSON.child,
              target: PERSON.partner,
              type,
            }),
          ],
        });

        expect(idsOf(tree.nodes)).toEqual([PERSON.parent, PERSON.child, PERSON.partner].sort());
        expect(idsOf(tree.edges)).toEqual([relationshipId(1), relationshipId(2)]);
      },
    );

    it.each(AUXILIARY_CASES)(
      "never lists a $type relation as lineage",
      ({ customType, directionality, type }) => {
        const tree = buildBookTree({
          edges: [
            parentOf({ child: PERSON.child, index: 1, parent: PERSON.parent }),
            relation({
              customType,
              directionality,
              index: 2,
              source: PERSON.child,
              target: PERSON.partner,
              type,
            }),
          ],
        });

        expect(lineageIdsOf(tree.lineage)).toEqual([relationshipId(1)]);
      },
    );
  });

  describe("non-family relations", () => {
    it.each(OUTSIDE_FAMILY_CASES)(
      "leaves out a $type edge of the $category category",
      ({ category, directionality, type }) => {
        const tree = buildBookTree({
          edges: [
            parentOf({ child: PERSON.child, index: 1, parent: PERSON.parent }),
            relation({
              category,
              directionality,
              index: 2,
              source: PERSON.child,
              target: PERSON.outsider,
              type,
            }),
          ],
        });

        expect(idsOf(tree.edges)).toEqual([relationshipId(1)]);
      },
    );

    it.each(OUTSIDE_FAMILY_CASES)(
      "leaves out a character linked to the family only by a $type edge",
      ({ category, directionality, type }) => {
        const tree = buildBookTree({
          edges: [
            parentOf({ child: PERSON.child, index: 1, parent: PERSON.parent }),
            relation({
              category,
              directionality,
              index: 2,
              source: PERSON.child,
              target: PERSON.outsider,
              type,
            }),
          ],
        });

        expect(idsOf(tree.nodes)).toEqual([PERSON.parent, PERSON.child].sort());
      },
    );
  });

  describe("spoilers", () => {
    function edgesWithHiddenRelatives(
      state: Partial<RelationshipBookStateSource>,
    ): GraphEdgeSource[] {
      return [
        parentOf({ child: PERSON.child, index: 1, parent: PERSON.parent }),
        relation({
          index: 2,
          source: PERSON.child,
          state,
          target: PERSON.hiddenChild,
          type: "biological_parent_of",
        }),
        relation({
          directionality: "symmetric",
          index: 3,
          source: PERSON.child,
          state,
          target: PERSON.hiddenSpouse,
          type: "spouse_of",
        }),
      ];
    }

    it.each(HIDDEN_STATE_CASES)(
      "leaves out a lineage and a spouse edge whose $reason",
      ({ state }) => {
        const tree = buildBookTree({ edges: edgesWithHiddenRelatives(state) });

        expect(idsOf(tree.edges)).toEqual([relationshipId(1)]);
        expect(lineageIdsOf(tree.lineage)).toEqual([relationshipId(1)]);
      },
    );

    it.each(HIDDEN_STATE_CASES)(
      "leaves out a character reachable only through a family edge whose $reason",
      ({ state }) => {
        const tree = buildBookTree({ edges: edgesWithHiddenRelatives(state) });

        expect(idsOf(tree.nodes)).toEqual([PERSON.parent, PERSON.child].sort());
      },
    );
  });

  describe("cycles", () => {
    const cyclicEdges = [
      parentOf({ child: PERSON.generation2, index: 1, parent: PERSON.generation1 }),
      parentOf({ child: PERSON.generation1, index: 2, parent: PERSON.generation2 }),
      parentOf({ child: PERSON.eastChild, index: 3, parent: PERSON.eastParent }),
    ];

    it("reports two people who are each other's parent as a family cycle diagnostic", () => {
      const tree = buildBookTree({ edges: cyclicEdges });

      expect(tree.diagnostics).toContainEqual(
        expect.objectContaining({
          characterIds: expect.arrayContaining([PERSON.generation1, PERSON.generation2]),
          code: CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected,
        }),
      );
    });

    it("keeps the cycle links out of the lineage while an unrelated link stays in it", () => {
      const tree = buildBookTree({ edges: cyclicEdges });

      expect(lineageIdsOf(tree.lineage)).toEqual([relationshipId(3)]);
    });
  });

  describe("node limit", () => {
    const threeFamilyEdges = [
      parentOf({ child: PERSON.small2, index: 1, parent: PERSON.small1 }),
      parentOf({ child: PERSON.middle2, index: 2, parent: PERSON.middle1 }),
      parentOf({ child: PERSON.middle3, index: 3, parent: PERSON.middle2 }),
      parentOf({ child: PERSON.large2, index: 4, parent: PERSON.large1 }),
      parentOf({ child: PERSON.large3, index: 5, parent: PERSON.large2 }),
      parentOf({ child: PERSON.large4, index: 6, parent: PERSON.large3 }),
    ];

    it("returns exactly as many people as the node limit allows", () => {
      const tree = buildBookTree({ edges: threeFamilyEdges, nodeLimit: 6 });

      expect(tree.nodes).toHaveLength(6);
    });

    it("keeps every member of the largest family when the node limit cuts the others", () => {
      const tree = buildBookTree({ edges: threeFamilyEdges, nodeLimit: 6 });

      expect(idsOf(tree.nodes)).toEqual(
        expect.arrayContaining([PERSON.large1, PERSON.large2, PERSON.large3, PERSON.large4]),
      );
    });

    it("flags truncation when the node limit leaves people out", () => {
      const tree = buildBookTree({ edges: threeFamilyEdges, nodeLimit: 6 });

      expect(tree.hiddenContent.truncated).toBe(true);
    });

    it("does not flag truncation when the node limit fits every family", () => {
      const tree = buildBookTree({ edges: threeFamilyEdges, nodeLimit: 9 });

      expect(tree.nodes).toHaveLength(9);
      expect(tree.hiddenContent.truncated).toBe(false);
    });
  });

  describe("edge limit", () => {
    const lineageAndSpouseEdges = [
      relation({
        directionality: "symmetric",
        index: 1,
        source: PERSON.child,
        target: PERSON.partner,
        type: "spouse_of",
      }),
      parentOf({ child: PERSON.child, index: 2, parent: PERSON.parent }),
      parentOf({ child: PERSON.grandchild, index: 3, parent: PERSON.child }),
    ];

    it("keeps lineage edges before an auxiliary edge when the edge limit is reached", () => {
      const tree = buildBookTree({ edgeLimit: 2, edges: lineageAndSpouseEdges });

      expect(idsOf(tree.edges)).toEqual([relationshipId(2), relationshipId(3)]);
      expect(lineageIdsOf(tree.lineage)).toEqual([relationshipId(2), relationshipId(3)]);
    });

    it("flags truncation when the edge limit drops an edge", () => {
      const tree = buildBookTree({ edgeLimit: 2, edges: lineageAndSpouseEdges });

      expect(tree.hiddenContent.truncated).toBe(true);
    });
  });

  describe("houses", () => {
    const parentAndChild = [parentOf({ child: PERSON.child, index: 1, parent: PERSON.parent })];

    it.each(HOUSE_GROUP_TYPES)("clusters both members of a %s group under its id", (type) => {
      const house = group({ type });
      const tree = buildBookTree({
        edges: parentAndChild,
        memberships: [
          membership({ characterId: PERSON.parent, membershipGroup: house }),
          membership({ characterId: PERSON.child, membershipGroup: house }),
        ],
      });

      expect(clusterOf({ id: PERSON.parent, nodes: tree.nodes })).toBe(groupId(1));
      expect(clusterOf({ id: PERSON.child, nodes: tree.nodes })).toBe(groupId(1));
    });

    it.each(HOUSE_GROUP_TYPES)(
      "lists a %s group among the houses with its member count as size",
      (type) => {
        const house = group({ type });
        const tree = buildBookTree({
          edges: parentAndChild,
          memberships: [
            membership({ characterId: PERSON.parent, membershipGroup: house }),
            membership({ characterId: PERSON.child, membershipGroup: house }),
          ],
        });

        expect(tree.houses).toEqual([
          { groupType: type, id: groupId(1), kind: "group", name: "Stark", size: 2 },
        ]);
      },
    );

    it("ignores a membership in an order group", () => {
      const order = group({ type: "order" });
      const tree = buildBookTree({
        edges: parentAndChild,
        memberships: [
          membership({ characterId: PERSON.parent, membershipGroup: order }),
          membership({ characterId: PERSON.child, membershipGroup: order }),
        ],
      });

      expect(tree.houses).toEqual([]);
      expect(clusterOf({ id: PERSON.parent, nodes: tree.nodes })).toBeNull();
    });

    it("does not cluster a character whose house membership is a spoiler", () => {
      const house = group({ type: "house" });
      const tree = buildBookTree({
        edges: parentAndChild,
        memberships: [
          membership({ characterId: PERSON.parent, membershipGroup: house }),
          membership({ characterId: PERSON.child, isSpoiler: true, membershipGroup: house }),
        ],
      });

      expect(clusterOf({ id: PERSON.parent, nodes: tree.nodes })).toBe(groupId(1));
      expect(clusterOf({ id: PERSON.child, nodes: tree.nodes })).toBeNull();
    });

    it("does not count a spoiler membership in the house size", () => {
      const house = group({ type: "house" });
      const tree = buildBookTree({
        edges: parentAndChild,
        memberships: [
          membership({ characterId: PERSON.parent, membershipGroup: house }),
          membership({ characterId: PERSON.child, isSpoiler: true, membershipGroup: house }),
        ],
      });

      expect(tree.houses).toEqual([
        { groupType: "house", id: groupId(1), kind: "group", name: "Stark", size: 1 },
      ]);
    });

    it("ignores a house group that is itself a spoiler", () => {
      const spoilerHouse = group({ isSpoiler: true, type: "house" });
      const tree = buildBookTree({
        edges: parentAndChild,
        memberships: [
          membership({ characterId: PERSON.parent, membershipGroup: spoilerHouse }),
          membership({ characterId: PERSON.child, membershipGroup: spoilerHouse }),
        ],
      });

      expect(tree.houses).toEqual([]);
      expect(clusterOf({ id: PERSON.parent, nodes: tree.nodes })).toBeNull();
    });
  });

  describe("graph version", () => {
    it("returns the same version for the same input", () => {
      const first = buildBookTree({
        edges: [parentOf({ child: PERSON.child, index: 1, parent: PERSON.parent })],
      });
      const second = buildBookTree({
        edges: [parentOf({ child: PERSON.child, index: 1, parent: PERSON.parent })],
      });

      expect(second.graphVersion).toBe(first.graphVersion);
    });

    it("changes the version when a family edge is added", () => {
      const before = buildBookTree({
        edges: [parentOf({ child: PERSON.child, index: 1, parent: PERSON.parent })],
      });
      const after = buildBookTree({
        edges: [
          parentOf({ child: PERSON.child, index: 1, parent: PERSON.parent }),
          parentOf({ child: PERSON.grandchild, index: 2, parent: PERSON.child }),
        ],
      });

      expect(after.graphVersion).not.toBe(before.graphVersion);
    });
  });
});
