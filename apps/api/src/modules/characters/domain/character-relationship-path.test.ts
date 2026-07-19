import type {
  CharacterGraphMode,
  Nullable,
  RelationshipCategory,
  RelationshipType,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GraphEdgeSource, GraphNodeSource } from "./character-graph.js";
import type { RelationshipBookStateSource } from "./character-relationship.mapper.js";

import { findVisibleRelationshipPath } from "./character-relationship-path.js";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAROL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DAVE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const BOOK = "20000000-0000-4000-8000-000000000001";
const MAX_VISITED = 5000;

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

function edgeSource(overrides: Partial<GraphEdgeSource>): GraphEdgeSource {
  return {
    bookStates: [stateSource({})],
    category: "social",
    customType: null,
    directionality: "symmetric",
    id: "rel-1",
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
    revealEdgeIds,
    toId,
    typeFilter,
  });
}

function nodeSource(overrides: Partial<GraphNodeSource> & { id: string }): GraphNodeSource {
  return {
    appearances: [
      {
        bookId: BOOK,
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        hidePresenceAsSpoiler: false,
        importance: "major",
      },
    ],
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

    expect(hiddenPath).toEqual({ edges: [], found: false, fromId: ALICE, nodes: [], toId: CAROL });
    expect(hiddenPath).toEqual(genuinelyUnconnected);
    expect(JSON.stringify(hiddenPath)).not.toContain("rel-2");
    expect(JSON.stringify(hiddenPath)).not.toContain(BOB);
  });

  it("does not surface a presence-hidden intermediate node on the shortest chain", () => {
    const result = find({
      edges: [
        edgeSource({ id: "rel-1", sourceCharacterId: ALICE, targetCharacterId: BOB }),
        edgeSource({
          bookStates: [stateSource({ id: "state-2", relationshipId: "rel-2" })],
          id: "rel-2",
          sourceCharacterId: BOB,
          targetCharacterId: CAROL,
        }),
      ],
      fromId: ALICE,
      nodes: [
        nodeSource({ id: ALICE }),
        nodeSource({
          appearances: [
            {
              bookId: BOOK,
              createdAt: new Date("2024-01-01T00:00:00.000Z"),
              hidePresenceAsSpoiler: true,
              importance: "central",
            },
          ],
          id: BOB,
        }),
        nodeSource({ id: CAROL }),
      ],
      toId: CAROL,
    });

    expect(result.found).toBe(false);
    expect(JSON.stringify(result)).not.toContain(BOB);
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
    expect(result.edges[0]).toMatchObject({ category: null, type: null, typeHidden: true });
    expect(JSON.stringify(result)).not.toContain("biological_parent_of");
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
});
