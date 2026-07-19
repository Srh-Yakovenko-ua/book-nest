import type {
  CharacterGraphMode,
  Nullable,
  RelationshipCategory,
  RelationshipType,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GraphEdgeSource, GraphNodeSource } from "./character-graph.js";
import type { RelationshipBookStateSource } from "./character-relationship.mapper.js";

import { buildCharacterGraph } from "./character-graph.js";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAROL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const BOOK = "20000000-0000-4000-8000-000000000001";

function build({
  categoryFilter = null,
  depth = 1,
  edgeLimit = 600,
  edges = [],
  focusCharacterId = null,
  mode = "all",
  nodeLimit = 300,
  nodes = [],
  partNumberById = new Map<string, Nullable<number>>(),
  revealEdgeIds = new Set<string>(),
  typeFilter = null,
}: {
  categoryFilter?: Nullable<Set<RelationshipCategory>>;
  depth?: number;
  edgeLimit?: number;
  edges?: GraphEdgeSource[];
  focusCharacterId?: Nullable<string>;
  mode?: CharacterGraphMode;
  nodeLimit?: number;
  nodes?: GraphNodeSource[];
  partNumberById?: Map<string, Nullable<number>>;
  revealEdgeIds?: Set<string>;
  typeFilter?: Nullable<Set<RelationshipType>>;
}) {
  return buildCharacterGraph({
    categoryFilter,
    depth,
    edgeLimit,
    edges,
    focusCharacterId,
    mode,
    nodeLimit,
    nodes,
    partNumberById,
    revealEdgeIds,
    typeFilter,
  });
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

describe("buildCharacterGraph", () => {
  it("assembles nodes and edges from a visible relationship with computed degree", () => {
    const graph = build({
      edges: [edgeSource({})],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.nodes.map((node) => node.id).sort()).toEqual([ALICE, BOB].sort());
    expect(graph.nodes.every((node) => node.degree === 1)).toBe(true);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({ source: ALICE, target: BOB, type: "friend_of" });
    expect(graph.graphVersion).toHaveLength(16);
    expect(graph.updatedAt).toBe("2024-01-02T00:00:00.000Z");
  });

  it("drops a presence-hidden node and every edge touching it without affecting other degrees", () => {
    const graph = build({
      edges: [
        edgeSource({ id: "rel-1", sourceCharacterId: ALICE, targetCharacterId: BOB }),
        edgeSource({
          bookStates: [stateSource({ id: "state-2", relationshipId: "rel-2" })],
          id: "rel-2",
          sourceCharacterId: ALICE,
          targetCharacterId: CAROL,
        }),
      ],
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
    });

    expect(graph.nodes.map((node) => node.id).sort()).toEqual([ALICE, CAROL].sort());
    expect(graph.edges.map((edge) => edge.id)).toEqual(["rel-2"]);
    expect(graph.nodes.find((node) => node.id === ALICE)?.degree).toBe(1);
    expect(graph.hiddenContent.hasHiddenNodes).toBe(true);
  });

  it("omits a hideRelationshipAsSpoiler edge and it never contributes to degree", () => {
    const graph = build({
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
          sourceCharacterId: ALICE,
          targetCharacterId: CAROL,
        }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })],
    });

    expect(graph.edges.map((edge) => edge.id)).toEqual(["rel-1"]);
    expect(graph.nodes.map((node) => node.id).sort()).toEqual([ALICE, BOB].sort());
    expect(graph.hiddenContent.hasHiddenEdges).toBe(true);
    expect(graph.nodes.find((node) => node.id === ALICE)?.degree).toBe(1);
  });

  it("keeps an isTypeSpoiler edge structurally but locks its type, category and labels", () => {
    const graph = build({
      edges: [
        edgeSource({
          bookStates: [stateSource({ isTypeSpoiler: true })],
          category: "family",
          directionality: "directed",
          sourceLabel: "parent",
          targetLabel: "child",
          type: "biological_parent_of",
        }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      category: null,
      sourceLabel: null,
      targetLabel: null,
      type: null,
      typeHidden: true,
    });
    expect(graph.hiddenContent.hasLockedEdges).toBe(true);
    expect(graph.nodes.every((node) => node.degree === 1)).toBe(true);
    expect(JSON.stringify(graph.edges)).not.toContain("biological_parent_of");
  });

  it("masks a spoiler description while keeping the type visible", () => {
    const graph = build({
      edges: [
        edgeSource({
          bookStates: [
            stateSource({ description: "they are the same person", isDescriptionSpoiler: true }),
          ],
        }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.edges[0]).toMatchObject({
      description: null,
      descriptionHidden: true,
      type: "friend_of",
      typeHidden: false,
    });
    expect(JSON.stringify(graph.edges)).not.toContain("same person");
  });

  it("un-masks only the named reveal edge without touching the others", () => {
    const graph = build({
      edges: [
        edgeSource({
          bookStates: [stateSource({ isTypeSpoiler: true })],
          id: "rel-1",
          sourceCharacterId: ALICE,
          targetCharacterId: BOB,
        }),
        edgeSource({
          bookStates: [
            stateSource({ id: "state-2", isTypeSpoiler: true, relationshipId: "rel-2" }),
          ],
          id: "rel-2",
          sourceCharacterId: ALICE,
          targetCharacterId: CAROL,
          type: "ally_of",
        }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })],
      revealEdgeIds: new Set(["rel-1"]),
    });

    const revealed = graph.edges.find((edge) => edge.id === "rel-1");
    const stillHidden = graph.edges.find((edge) => edge.id === "rel-2");
    expect(revealed).toMatchObject({ revealed: true, type: "friend_of", typeHidden: false });
    expect(stillHidden).toMatchObject({ revealed: false, type: null, typeHidden: true });
  });

  it("selects the representative book state by part number, not the earliest", () => {
    const partNumberById = new Map<string, Nullable<number>>([
      ["book-2", 2],
      [BOOK, 1],
    ]);
    const graph = build({
      edges: [
        edgeSource({
          bookStates: [
            stateSource({ bookId: BOOK, id: "state-1", status: "active" }),
            stateSource({ bookId: "book-2", id: "state-2", status: "ended" }),
          ],
        }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
      partNumberById,
    });

    expect(graph.edges[0]?.status).toBe("ended");
  });

  it("bounds a focus traversal by depth over the visible edge set", () => {
    const chain = [
      edgeSource({ id: "rel-1", sourceCharacterId: ALICE, targetCharacterId: BOB }),
      edgeSource({
        bookStates: [stateSource({ id: "state-2", relationshipId: "rel-2" })],
        id: "rel-2",
        sourceCharacterId: BOB,
        targetCharacterId: CAROL,
      }),
    ];
    const nodes = [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })];

    const shallow = build({ depth: 1, edges: chain, focusCharacterId: ALICE, nodes });
    expect(shallow.nodes.map((node) => node.id).sort()).toEqual([ALICE, BOB].sort());

    const deep = build({ depth: 2, edges: chain, focusCharacterId: ALICE, nodes });
    expect(deep.nodes.map((node) => node.id).sort()).toEqual([ALICE, BOB, CAROL].sort());
  });

  it("cannot traverse a hidden edge as a focus hop", () => {
    const graph = build({
      depth: 3,
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
      focusCharacterId: ALICE,
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })],
    });

    expect(graph.nodes.map((node) => node.id).sort()).toEqual([ALICE, BOB].sort());
    expect(graph.nodes.some((node) => node.id === CAROL)).toBe(false);
  });

  it("restricts family mode to family and romantic categories", () => {
    const graph = build({
      edges: [
        edgeSource({
          category: "family",
          directionality: "symmetric",
          id: "rel-1",
          sourceCharacterId: ALICE,
          targetCharacterId: BOB,
          type: "sibling_of",
        }),
        edgeSource({
          bookStates: [stateSource({ id: "state-2", relationshipId: "rel-2" })],
          category: "conflict",
          id: "rel-2",
          sourceCharacterId: ALICE,
          targetCharacterId: CAROL,
          type: "enemy_of",
        }),
      ],
      mode: "family",
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })],
    });

    expect(graph.edges.map((edge) => edge.id)).toEqual(["rel-1"]);
    expect(graph.mode).toBe("family");
  });

  it("flags the truncation and hiddenContent when the node cap is hit", () => {
    const graph = build({
      edges: [
        edgeSource({ id: "rel-1", sourceCharacterId: ALICE, targetCharacterId: BOB }),
        edgeSource({
          bookStates: [stateSource({ id: "state-2", relationshipId: "rel-2" })],
          id: "rel-2",
          sourceCharacterId: BOB,
          targetCharacterId: CAROL,
        }),
      ],
      nodeLimit: 2,
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })],
    });

    expect(graph.nodes.length).toBeLessThanOrEqual(2);
    expect(graph.hiddenContent.truncated).toBe(true);
  });

  it("reports a family ancestry cycle among visible edges as a conflict diagnostic", () => {
    const graph = build({
      edges: [
        edgeSource({
          category: "family",
          directionality: "directed",
          id: "rel-1",
          sourceCharacterId: ALICE,
          targetCharacterId: BOB,
          type: "biological_parent_of",
        }),
        edgeSource({
          bookStates: [stateSource({ id: "state-2", relationshipId: "rel-2" })],
          category: "family",
          directionality: "directed",
          id: "rel-2",
          sourceCharacterId: BOB,
          targetCharacterId: ALICE,
          type: "biological_parent_of",
        }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.diagnostics).toHaveLength(1);
    expect(graph.diagnostics[0]).toMatchObject({
      code: "family_cycle_detected",
      severity: "conflict",
    });
  });
});
