import type {
  CharacterGraphMode,
  Nullable,
  RelationshipCategory,
  RelationshipType,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GraphEdgeSource, GraphNodeSource } from "./character-graph.js";
import type { RelationshipBookStateSource } from "./character-relationship.mapper.js";
import type {
  ReaderBookPosition,
  RelationshipReaderContext,
} from "./relationship-reader-projection.js";

import { findVisibleRelationshipPath } from "./character-relationship-path.js";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAROL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DAVE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ERIN = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const FRANK = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const BOOK = "20000000-0000-4000-8000-000000000001";
const MAX_VISITED = 5000;
const LONG_CHAIN_IDS = [ALICE, BOB, CAROL, DAVE, ERIN, FRANK];

function chain(): GraphEdgeSource[] {
  return [
    edgeSource({ id: "rel-1", sourceCharacterId: ALICE, targetCharacterId: BOB }),
    edgeSource({
      bookStates: [stateSource({ id: "state-2", relationshipId: "rel-2" })],
      id: "rel-2",
      sourceCharacterId: BOB,
      targetCharacterId: CAROL,
    }),
  ];
}

function contextBookReaderContext(position: ReaderBookPosition): RelationshipReaderContext {
  return {
    books: new Map([
      [BOOK, { id: BOOK, partNumber: null, position, seriesId: null, title: "Book" }],
    ]),
    scope: { contextBookId: BOOK, kind: "as_of" },
  };
}

function edgeSource(overrides: Partial<GraphEdgeSource>): GraphEdgeSource {
  return {
    bookStates: [stateSource({})],
    category: "social",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    customType: null,
    directionality: "symmetric",
    id: "rel-1",
    isCanonical: true,
    sourceCharacterId: ALICE,
    sourceLabel: null,
    targetCharacterId: BOB,
    targetLabel: null,
    type: "friend_of",
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function find({
  categoryFilter = null,
  edges = [],
  fromId,
  maxVisitedNodes = MAX_VISITED,
  mode = "all",
  nodes = [],
  partNumberById = new Map<string, Nullable<number>>(),
  readerPosition = { kind: "unknown" },
  revealEdgeIds = new Set<string>(),
  toId,
  typeFilter = null,
}: {
  categoryFilter?: Nullable<Set<RelationshipCategory>>;
  edges?: GraphEdgeSource[];
  fromId: string;
  maxVisitedNodes?: number;
  mode?: CharacterGraphMode;
  nodes?: GraphNodeSource[];
  partNumberById?: Map<string, Nullable<number>>;
  readerPosition?: ReaderBookPosition;
  revealEdgeIds?: Set<string>;
  toId: string;
  typeFilter?: Nullable<Set<RelationshipType>>;
}) {
  return findVisibleRelationshipPath({
    categoryFilter,
    edges,
    fromId,
    maxVisitedNodes,
    mode,
    nodes,
    partNumberById,
    readerContext: contextBookReaderContext(readerPosition),
    revealEdgeIds,
    toId,
    typeFilter,
  });
}

function linkSource({
  id,
  source,
  target,
}: {
  id: string;
  source: string;
  target: string;
}): GraphEdgeSource {
  return edgeSource({
    bookStates: [stateSource({ id: `state-${id}`, relationshipId: id })],
    id,
    sourceCharacterId: source,
    targetCharacterId: target,
  });
}

function longChain(): GraphEdgeSource[] {
  return [
    linkSource({ id: "rel-1", source: ALICE, target: BOB }),
    linkSource({ id: "rel-2", source: BOB, target: CAROL }),
    linkSource({ id: "rel-3", source: CAROL, target: DAVE }),
    linkSource({ id: "rel-4", source: DAVE, target: ERIN }),
    linkSource({ id: "rel-5", source: ERIN, target: FRANK }),
  ];
}

function nodeSource(overrides: Partial<GraphNodeSource> & { id: string }): GraphNodeSource {
  return {
    appearances: [
      {
        bookId: BOOK,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        displayName: null,
        displayNameIsSpoiler: false,
        importance: "major",
        portrait: null,
        portraitIsSpoiler: false,
        portraitMediaId: null,
      },
    ],
    avatar: null,
    entityKind: "individual",
    isFavorite: false,
    name: overrides.id,
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function stateSource(overrides: Partial<RelationshipBookStateSource>): RelationshipBookStateSource {
  return {
    bookId: BOOK,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    description: null,
    endedAudioSeconds: null,
    endedChapter: null,
    endedPage: null,
    hideRelationshipAsSpoiler: false,
    id: "state-1",
    intensity: null,
    introducedAudioSeconds: null,
    introducedChapter: null,
    introducedPage: null,
    isDescriptionSpoiler: false,
    isTypeSpoiler: false,
    relationshipId: "rel-1",
    status: "active",
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

describe("findVisibleRelationshipPath", () => {
  it("returns the shortest visible chain of nodes and edges in order", () => {
    const result = find({
      edges: chain(),
      fromId: ALICE,
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })],
      toId: CAROL,
    });

    expect(result.found).toBe(true);
    expect(result.searchLimited).toBe(false);
    expect(result.nodes.map((node) => node.id)).toEqual([ALICE, BOB, CAROL]);
    expect(result.edges.map((edge) => edge.id)).toEqual(["rel-1", "rel-2"]);
    expect(result.fromId).toBe(ALICE);
    expect(result.toId).toBe(CAROL);
  });

  it("prefers a direct edge over a longer chain", () => {
    const result = find({
      edges: [
        ...chain(),
        edgeSource({
          bookStates: [stateSource({ id: "state-3", relationshipId: "rel-3" })],
          id: "rel-3",
          sourceCharacterId: ALICE,
          targetCharacterId: CAROL,
        }),
      ],
      fromId: ALICE,
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })],
      toId: CAROL,
    });

    expect(result.found).toBe(true);
    expect(result.nodes.map((node) => node.id)).toEqual([ALICE, CAROL]);
    expect(result.edges.map((edge) => edge.id)).toEqual(["rel-3"]);
  });

  it("returns found:false identical to unconnected when the only path runs through a hidden edge", () => {
    const hiddenPath = find({
      edges: [
        edgeSource({ id: "rel-1", sourceCharacterId: ALICE, targetCharacterId: BOB }),
        edgeSource({
          bookStates: [
            stateSource({
              hideRelationshipAsSpoiler: true,
              id: "state-2",
              relationshipId: "rel-2",
            }),
          ],
          id: "rel-2",
          sourceCharacterId: BOB,
          targetCharacterId: CAROL,
        }),
      ],
      fromId: ALICE,
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })],
      toId: CAROL,
    });

    const genuinelyUnconnected = find({
      edges: [edgeSource({ id: "rel-1", sourceCharacterId: ALICE, targetCharacterId: BOB })],
      fromId: ALICE,
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })],
      toId: CAROL,
    });

    expect(hiddenPath).toEqual({
      edges: [],
      found: false,
      fromId: ALICE,
      nodes: [],
      searchLimited: false,
      toId: CAROL,
    });
    expect(hiddenPath).toEqual(genuinelyUnconnected);
    expect(JSON.stringify(hiddenPath)).not.toContain("rel-2");
    expect(JSON.stringify(hiddenPath)).not.toContain(BOB);
  });

  it("keeps an isTypeSpoiler hop present but type-locked", () => {
    const result = find({
      edges: [
        edgeSource({
          bookStates: [stateSource({ isTypeSpoiler: true })],
          category: "family",
          directionality: "directed",
          type: "biological_parent_of",
        }),
      ],
      fromId: ALICE,
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
      toId: BOB,
    });

    expect(result.found).toBe(true);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      category: null,
      directionality: null,
      type: null,
      typeHidden: true,
    });
    expect(JSON.stringify(result)).not.toContain("biological_parent_of");
  });

  it("cannot route through an edge whose introduction lies beyond the reader position", () => {
    const edges = [
      edgeSource({ id: "rel-1", sourceCharacterId: ALICE, targetCharacterId: BOB }),
      edgeSource({
        bookStates: [stateSource({ id: "state-2", introducedPage: 80, relationshipId: "rel-2" })],
        id: "rel-2",
        sourceCharacterId: BOB,
        targetCharacterId: CAROL,
      }),
    ];
    const nodes = [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })];

    const early = find({
      edges,
      fromId: ALICE,
      nodes,
      readerPosition: { kind: "position", reader: { page: 40 } },
      toId: CAROL,
    });
    const late = find({
      edges,
      fromId: ALICE,
      nodes,
      readerPosition: { kind: "position", reader: { page: 80 } },
      toId: CAROL,
    });

    expect(early.found).toBe(false);
    expect(late.edges.map((edge) => edge.id)).toEqual(["rel-1", "rel-2"]);
  });

  it("treats fromId equal to toId as a trivially connected single node", () => {
    const result = find({
      edges: [],
      fromId: ALICE,
      nodes: [nodeSource({ id: ALICE })],
      toId: ALICE,
    });

    expect(result.found).toBe(true);
    expect(result.nodes.map((node) => node.id)).toEqual([ALICE]);
    expect(result.edges).toHaveLength(0);
  });

  it("terminates and returns the shortest path over a cyclic visible graph", () => {
    const result = find({
      edges: [
        edgeSource({ id: "rel-1", sourceCharacterId: ALICE, targetCharacterId: BOB }),
        edgeSource({
          bookStates: [stateSource({ id: "state-2", relationshipId: "rel-2" })],
          id: "rel-2",
          sourceCharacterId: BOB,
          targetCharacterId: CAROL,
        }),
        edgeSource({
          bookStates: [stateSource({ id: "state-3", relationshipId: "rel-3" })],
          id: "rel-3",
          sourceCharacterId: CAROL,
          targetCharacterId: ALICE,
        }),
        edgeSource({
          bookStates: [stateSource({ id: "state-4", relationshipId: "rel-4" })],
          id: "rel-4",
          sourceCharacterId: CAROL,
          targetCharacterId: DAVE,
        }),
      ],
      fromId: ALICE,
      nodes: [
        nodeSource({ id: ALICE }),
        nodeSource({ id: BOB }),
        nodeSource({ id: CAROL }),
        nodeSource({ id: DAVE }),
      ],
      toId: DAVE,
    });

    expect(result.found).toBe(true);
    expect(result.nodes.map((node) => node.id)).toEqual([ALICE, CAROL, DAVE]);
    expect(result.edges.map((edge) => edge.id)).toEqual(["rel-3", "rel-4"]);
  });

  describe("visit budget", () => {
    it("finds the target when the budget equals the number of nodes on the path", () => {
      const result = find({
        edges: longChain(),
        fromId: ALICE,
        maxVisitedNodes: 6,
        nodes: LONG_CHAIN_IDS.map((id) => nodeSource({ id })),
        toId: FRANK,
      });

      expect(result.found).toBe(true);
      expect(result.searchLimited).toBe(false);
      expect(result.nodes.map((node) => node.id)).toEqual(LONG_CHAIN_IDS);
    });

    it("reports a limited search with no path when the budget is one node short", () => {
      const result = find({
        edges: longChain(),
        fromId: ALICE,
        maxVisitedNodes: 5,
        nodes: LONG_CHAIN_IDS.map((id) => nodeSource({ id })),
        toId: FRANK,
      });

      expect(result).toEqual({
        edges: [],
        found: false,
        fromId: ALICE,
        nodes: [],
        searchLimited: true,
        toId: FRANK,
      });
    });

    it("reports an unreachable target as not limited when its search ran out before the budget", () => {
      const result = find({
        edges: chain(),
        fromId: ALICE,
        maxVisitedNodes: 4,
        nodes: [
          nodeSource({ id: ALICE }),
          nodeSource({ id: BOB }),
          nodeSource({ id: CAROL }),
          nodeSource({ id: DAVE }),
        ],
        toId: DAVE,
      });

      expect(result).toEqual({
        edges: [],
        found: false,
        fromId: ALICE,
        nodes: [],
        searchLimited: false,
        toId: DAVE,
      });
    });
  });
});
