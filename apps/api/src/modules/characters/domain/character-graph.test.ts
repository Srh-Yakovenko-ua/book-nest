import type {
  CharacterGraphClusterBy,
  CharacterGraphEdgeView,
  CharacterGraphMode,
  MediaView,
  Nullable,
  RelationshipCategory,
  RelationshipType,
} from "@app/shared";

import { describe, expect, it } from "vitest";

import type {
  GraphCapPolicy,
  GraphEdgeSource,
  GraphMembershipSource,
  GraphNodeAppearance,
  GraphNodeSource,
} from "./character-graph.js";
import type { RelationshipBookStateSource } from "./character-relationship.mapper.js";
import type {
  ReaderBookPosition,
  RelationshipReaderContext,
} from "./relationship-reader-projection.js";

import { buildCharacterGraph } from "./character-graph.js";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CAROL = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const DAVE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ERIN = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const FRANK = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const BOOK = "20000000-0000-4000-8000-000000000001";
const GROUP_CABAL = "0c0c0c0c-0c0c-4c0c-8c0c-0c0c0c0c0c0c";
const GROUP_STARK = "10000000-0000-4000-8000-000000000001";
const GROUP_SECRET = "10000000-0000-4000-8000-000000000002";
const AVATAR_MEDIA = "40000000-0000-4000-8000-000000000001";
const PORTRAIT_MEDIA = "40000000-0000-4000-8000-000000000002";

function appearanceSource(overrides: Partial<GraphNodeAppearance>): GraphNodeAppearance {
  return {
    bookId: BOOK,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    displayName: null,
    displayNameIsSpoiler: false,
    importance: "major",
    portrait: null,
    portraitIsSpoiler: false,
    portraitMediaId: null,
    ...overrides,
  };
}

function asOfReaderContext({
  allowedBookIds,
  partNumberById,
  readerPosition,
}: {
  allowedBookIds: string[];
  partNumberById: Map<string, Nullable<number>>;
  readerPosition: ReaderBookPosition;
}): RelationshipReaderContext {
  return {
    books: new Map(
      allowedBookIds.map((id) => [
        id,
        {
          id,
          partNumber: partNumberById.get(id) ?? null,
          position: readerPosition,
          seriesId: null,
          title: id,
        },
      ]),
    ),
    scope: { contextBookId: BOOK, kind: "as_of" },
  };
}

function build({
  allowedBookIds = [BOOK],
  capPolicy = "legacy",
  categoryFilter = null,
  clusterBy = null,
  depth = 1,
  edgeLimit = 600,
  edges = [],
  focusCharacterId = null,
  memberships = [],
  mode = "all",
  nodeLimit = 300,
  nodes = [],
  partNumberById = new Map<string, Nullable<number>>(),
  readerPosition = { kind: "unknown" },
  revealEdgeIds = new Set<string>(),
  typeFilter = null,
}: {
  allowedBookIds?: string[];
  capPolicy?: GraphCapPolicy;
  categoryFilter?: Nullable<Set<RelationshipCategory>>;
  clusterBy?: Nullable<CharacterGraphClusterBy>;
  depth?: number;
  edgeLimit?: number;
  edges?: GraphEdgeSource[];
  focusCharacterId?: Nullable<string>;
  memberships?: GraphMembershipSource[];
  mode?: CharacterGraphMode;
  nodeLimit?: number;
  nodes?: GraphNodeSource[];
  partNumberById?: Map<string, Nullable<number>>;
  readerPosition?: ReaderBookPosition;
  revealEdgeIds?: Set<string>;
  typeFilter?: Nullable<Set<RelationshipType>>;
}) {
  return buildCharacterGraph({
    allowedBookIds,
    capPolicy,
    categoryFilter,
    clusterBy,
    depth,
    edgeLimit,
    edges,
    focusCharacterId,
    memberships,
    mode,
    nodeLimit,
    nodes,
    partNumberById,
    readerContext: asOfReaderContext({ allowedBookIds, partNumberById, readerPosition }),
    revealEdgeIds,
    typeFilter,
  });
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

function mediaView(id: string): MediaView {
  return {
    contentType: "image/webp",
    createdAt: "2024-01-01T00:00:00.000Z",
    height: 512,
    id,
    kind: "avatar",
    name: null,
    sizeBytes: 2048,
    urls: {
      card: `/media/${id}/card.webp`,
      full: `/media/${id}/full.webp`,
      thumb: `/media/${id}/thumb.webp`,
    },
    width: 512,
  };
}

function membershipSource(
  overrides: Partial<GraphMembershipSource> & { characterId: string },
): GraphMembershipSource {
  return {
    bookId: null,
    group: {
      id: GROUP_STARK,
      isSpoiler: false,
      name: "House Stark",
      type: "house",
    },
    isSpoiler: false,
    ...overrides,
  };
}

function nodeSource(overrides: Partial<GraphNodeSource> & { id: string }): GraphNodeSource {
  return {
    appearances: [appearanceSource({})],
    avatar: null,
    entityKind: "individual",
    isFavorite: false,
    name: overrides.id,
    updatedAt: new Date("2024-01-02T00:00:00.000Z"),
    ...overrides,
  };
}

function reachableFrom({
  edges,
  start,
}: {
  edges: CharacterGraphEdgeView[];
  start: string;
}): Set<string> {
  const reached = new Set<string>([start]);
  let frontier = [start];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const edge of edges) {
      if (frontier.includes(edge.source) && !reached.has(edge.target)) {
        reached.add(edge.target);
        next.push(edge.target);
      }
      if (frontier.includes(edge.target) && !reached.has(edge.source)) {
        reached.add(edge.source);
        next.push(edge.source);
      }
    }
    frontier = next;
  }
  return reached;
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

  it("keeps every appearing node and all of its edges in the degree count", () => {
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
          appearances: [appearanceSource({ importance: "central" })],
          id: BOB,
        }),
        nodeSource({ id: CAROL }),
      ],
    });

    expect(graph.nodes.map((node) => node.id).sort()).toEqual([ALICE, BOB, CAROL].sort());
    expect(graph.edges.map((edge) => edge.id).sort()).toEqual(["rel-1", "rel-2"]);
    expect(graph.nodes.find((node) => node.id === ALICE)?.degree).toBe(2);
    expect(graph.hiddenContent).toEqual({
      hasHiddenEdges: false,
      hasLockedEdges: false,
      truncated: false,
    });
  });

  it("omits a hideRelationshipAsSpoiler edge without advertising it and it never contributes to degree", () => {
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
    expect(graph.hiddenContent.hasHiddenEdges).toBe(false);
    expect(graph.nodes.find((node) => node.id === ALICE)?.degree).toBe(1);
  });

  it("keeps an isTypeSpoiler edge structurally but locks its type, category, labels and directionality", () => {
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
      directionality: null,
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
      allowedBookIds: [BOOK, "book-2"],
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

  it("leaves the graph unclustered by default", () => {
    const graph = build({
      edges: [edgeSource({})],
      memberships: [
        membershipSource({ characterId: ALICE }),
        membershipSource({ characterId: BOB }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.clusterBy).toBeNull();
    expect(graph.clusters).toEqual([]);
    expect(graph.nodes.every((node) => node.clusterId === null)).toBe(true);
  });

  it("assigns clusterBy=group clusters from visible memberships with a legend", () => {
    const graph = build({
      clusterBy: "group",
      edges: [edgeSource({})],
      memberships: [
        membershipSource({ characterId: ALICE }),
        membershipSource({ characterId: BOB }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.clusterBy).toBe("group");
    expect(graph.nodes.every((node) => node.clusterId === GROUP_STARK)).toBe(true);
    expect(graph.clusters).toEqual([
      { groupType: "house", id: GROUP_STARK, kind: "group", name: "House Stark", size: 2 },
    ]);
  });

  it("does not let a spoiler membership change a node's cluster in safe context", () => {
    const graph = build({
      clusterBy: "group",
      edges: [edgeSource({})],
      memberships: [
        membershipSource({ characterId: ALICE }),
        membershipSource({ characterId: BOB, isSpoiler: true }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.nodes.find((node) => node.id === ALICE)?.clusterId).toBe(GROUP_STARK);
    expect(graph.nodes.find((node) => node.id === BOB)?.clusterId).toBeNull();
    expect(graph.clusters).toEqual([
      { groupType: "house", id: GROUP_STARK, kind: "group", name: "House Stark", size: 1 },
    ]);
  });

  it("counts every appearing member in its cluster and the cluster size", () => {
    const graph = build({
      clusterBy: "group",
      edges: [
        edgeSource({ id: "rel-1", sourceCharacterId: ALICE, targetCharacterId: CAROL }),
        edgeSource({
          bookStates: [stateSource({ id: "state-2", relationshipId: "rel-2" })],
          id: "rel-2",
          sourceCharacterId: ALICE,
          targetCharacterId: BOB,
        }),
      ],
      memberships: [
        membershipSource({ characterId: ALICE }),
        membershipSource({ characterId: BOB }),
        membershipSource({ characterId: CAROL }),
      ],
      nodes: [
        nodeSource({ id: ALICE }),
        nodeSource({
          appearances: [appearanceSource({ importance: "central" })],
          id: BOB,
        }),
        nodeSource({ id: CAROL }),
      ],
    });

    expect(graph.nodes.find((node) => node.id === BOB)?.clusterId).toBe(GROUP_STARK);
    expect(graph.clusters).toEqual([
      { groupType: "house", id: GROUP_STARK, kind: "group", name: "House Stark", size: 3 },
    ]);
  });

  it("forms no cluster for a spoiler group and leaks none of its id, type, name or size", () => {
    const graph = build({
      clusterBy: "group",
      edges: [edgeSource({})],
      memberships: [
        membershipSource({
          characterId: ALICE,
          group: { id: GROUP_SECRET, isSpoiler: true, name: "The Faceless Men", type: "cult" },
        }),
        membershipSource({
          characterId: BOB,
          group: { id: GROUP_SECRET, isSpoiler: true, name: "The Faceless Men", type: "cult" },
        }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.clusters).toEqual([]);
    expect(graph.nodes.map((node) => node.clusterId)).toEqual([null, null]);
    const serialized = JSON.stringify(graph);
    expect(serialized).not.toContain(GROUP_SECRET);
    expect(serialized).not.toContain("cult");
    expect(serialized).not.toContain("Faceless Men");
  });

  it("forms no cluster from memberships that are themselves spoilers", () => {
    const graph = build({
      clusterBy: "group",
      edges: [edgeSource({})],
      memberships: [
        membershipSource({ characterId: ALICE, isSpoiler: true }),
        membershipSource({ characterId: BOB, isSpoiler: true }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.clusters).toEqual([]);
    expect(graph.nodes.map((node) => node.clusterId)).toEqual([null, null]);
    expect(JSON.stringify(graph)).not.toContain(GROUP_STARK);
  });

  it("clusters a node only under its safe group when it also belongs to a spoiler group", () => {
    const graph = build({
      clusterBy: "group",
      edges: [edgeSource({})],
      memberships: [
        membershipSource({
          characterId: ALICE,
          group: { id: GROUP_CABAL, isSpoiler: true, name: "The Cabal", type: "cult" },
        }),
        membershipSource({ characterId: ALICE }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.nodes.find((node) => node.id === ALICE)?.clusterId).toBe(GROUP_STARK);
    expect(graph.clusters).toEqual([
      { groupType: "house", id: GROUP_STARK, kind: "group", name: "House Stark", size: 1 },
    ]);
    expect(JSON.stringify(graph)).not.toContain(GROUP_CABAL);
  });

  it("excludes a membership scoped to a book beyond the reading context", () => {
    const graph = build({
      allowedBookIds: [BOOK],
      clusterBy: "group",
      edges: [edgeSource({})],
      memberships: [
        membershipSource({ bookId: "30000000-0000-4000-8000-000000000009", characterId: ALICE }),
        membershipSource({ characterId: BOB }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.nodes.find((node) => node.id === ALICE)?.clusterId).toBeNull();
    expect(graph.nodes.find((node) => node.id === BOB)?.clusterId).toBe(GROUP_STARK);
    expect(graph.clusters).toEqual([
      { groupType: "house", id: GROUP_STARK, kind: "group", name: "House Stark", size: 1 },
    ]);
  });

  it("buckets clusterBy=importance by the as-of-context importance", () => {
    const graph = build({
      clusterBy: "importance",
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
        nodeSource({
          appearances: [appearanceSource({ importance: "central" })],
          id: ALICE,
        }),
        nodeSource({ id: BOB }),
        nodeSource({ id: CAROL }),
      ],
    });

    expect(graph.clusterBy).toBe("importance");
    expect(graph.nodes.find((node) => node.id === ALICE)?.clusterId).toBe("central");
    expect(graph.nodes.find((node) => node.id === BOB)?.clusterId).toBe("major");
    expect(graph.clusters).toEqual([
      { id: "central", importance: "central", kind: "importance", size: 1 },
      { id: "major", importance: "major", kind: "importance", size: 2 },
    ]);
  });

  it("does not let a category filter match the masked category of a type-hidden edge", () => {
    const graph = build({
      categoryFilter: new Set<RelationshipCategory>(["family"]),
      edges: [
        edgeSource({
          bookStates: [stateSource({ isTypeSpoiler: true })],
          category: "family",
          type: "sibling_of",
        }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
    });

    expect(graph.edges).toEqual([]);
  });

  it("does not let a type filter match the masked type of a type-hidden edge", () => {
    const graph = build({
      edges: [
        edgeSource({
          bookStates: [stateSource({ isTypeSpoiler: true })],
          category: "family",
          type: "sibling_of",
        }),
      ],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
      typeFilter: new Set<RelationshipType>(["sibling_of"]),
    });

    expect(graph.edges).toEqual([]);
  });

  it("omits an edge with an introduction marker while the reader position is unknown", () => {
    const graph = build({
      edges: [edgeSource({ bookStates: [stateSource({ introducedPage: 10 })] })],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
      readerPosition: { kind: "unknown" },
    });

    expect(graph.edges).toEqual([]);
    expect(graph.hiddenContent.hasHiddenEdges).toBe(false);
  });

  it("shows an edge with an introduction marker once the reader position reaches it", () => {
    const graph = build({
      edges: [edgeSource({ bookStates: [stateSource({ introducedPage: 10 })] })],
      nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB })],
      readerPosition: { kind: "position", reader: { page: 10 } },
    });

    expect(graph.edges.map((edge) => edge.id)).toEqual(["rel-1"]);
  });

  it("withholds an ended status until the reader reaches the end marker", () => {
    const edges = [edgeSource({ bookStates: [stateSource({ endedPage: 50, status: "ended" })] })];
    const nodes = [nodeSource({ id: ALICE }), nodeSource({ id: BOB })];

    const midway = build({
      edges,
      nodes,
      readerPosition: { kind: "position", reader: { page: 20 } },
    });
    const finished = build({ edges, nodes, readerPosition: { kind: "finished" } });

    expect(midway.edges[0]?.status).toBeNull();
    expect(finished.edges[0]?.status).toBe("ended");
  });

  describe("node identity", () => {
    it("shows the trimmed book display name when it is not a spoiler", () => {
      const graph = build({
        edges: [edgeSource({})],
        nodes: [
          nodeSource({
            appearances: [appearanceSource({ displayName: "  Arya Stark  " })],
            id: ALICE,
            name: "Arya",
          }),
          nodeSource({ id: BOB }),
        ],
      });

      expect(graph.nodes.find((node) => node.id === ALICE)).toMatchObject({
        displayName: "Arya Stark",
        name: "Arya",
      });
    });

    it("falls back to the global name when the book display name is a spoiler", () => {
      const graph = build({
        edges: [edgeSource({})],
        nodes: [
          nodeSource({
            appearances: [appearanceSource({ displayName: "No One", displayNameIsSpoiler: true })],
            id: ALICE,
            name: "Arya",
          }),
          nodeSource({ id: BOB }),
        ],
      });

      expect(graph.nodes.find((node) => node.id === ALICE)?.displayName).toBe("Arya");
      expect(JSON.stringify(graph)).not.toContain("No One");
    });

    it("falls back to the global name when the book display name is blank", () => {
      const graph = build({
        edges: [edgeSource({})],
        nodes: [
          nodeSource({
            appearances: [appearanceSource({ displayName: "   " })],
            id: ALICE,
            name: "Arya",
          }),
          nodeSource({ id: BOB }),
        ],
      });

      expect(graph.nodes.find((node) => node.id === ALICE)?.displayName).toBe("Arya");
    });

    it("falls back to the global name and avatar when the node has no appearance in the reading context", () => {
      const graph = build({
        edges: [edgeSource({})],
        nodes: [
          nodeSource({
            appearances: [],
            avatar: mediaView(AVATAR_MEDIA),
            id: ALICE,
            name: "Arya",
          }),
          nodeSource({ id: BOB }),
        ],
      });

      expect(graph.nodes.find((node) => node.id === ALICE)).toMatchObject({
        displayMedia: mediaView(AVATAR_MEDIA),
        displayName: "Arya",
      });
    });

    it("shows the book portrait over the avatar when the portrait is not a spoiler", () => {
      const graph = build({
        edges: [edgeSource({})],
        nodes: [
          nodeSource({
            appearances: [
              appearanceSource({
                portrait: mediaView(PORTRAIT_MEDIA),
                portraitMediaId: PORTRAIT_MEDIA,
              }),
            ],
            avatar: mediaView(AVATAR_MEDIA),
            id: ALICE,
          }),
          nodeSource({ id: BOB }),
        ],
      });

      expect(graph.nodes.find((node) => node.id === ALICE)?.displayMedia).toEqual(
        mediaView(PORTRAIT_MEDIA),
      );
    });

    it("shows the avatar instead of a portrait marked as a spoiler", () => {
      const graph = build({
        edges: [edgeSource({})],
        nodes: [
          nodeSource({
            appearances: [
              appearanceSource({
                portrait: mediaView(PORTRAIT_MEDIA),
                portraitIsSpoiler: true,
                portraitMediaId: PORTRAIT_MEDIA,
              }),
            ],
            avatar: mediaView(AVATAR_MEDIA),
            id: ALICE,
          }),
          nodeSource({ id: BOB }),
        ],
      });

      expect(graph.nodes.find((node) => node.id === ALICE)?.displayMedia).toEqual(
        mediaView(AVATAR_MEDIA),
      );
      expect(JSON.stringify(graph)).not.toContain(PORTRAIT_MEDIA);
    });

    it("shows no media for a spoiler portrait when the character has no avatar", () => {
      const graph = build({
        edges: [edgeSource({})],
        nodes: [
          nodeSource({
            appearances: [
              appearanceSource({
                portrait: mediaView(PORTRAIT_MEDIA),
                portraitIsSpoiler: true,
                portraitMediaId: PORTRAIT_MEDIA,
              }),
            ],
            id: ALICE,
          }),
          nodeSource({ id: BOB }),
        ],
      });

      expect(graph.nodes.find((node) => node.id === ALICE)?.displayMedia).toBeNull();
      expect(JSON.stringify(graph)).not.toContain(PORTRAIT_MEDIA);
    });
  });

  describe("connected cap policy", () => {
    it("returns only the focused root when it has no visible edges", () => {
      const graph = build({
        capPolicy: "connected",
        edges: [
          edgeSource({
            bookStates: [stateSource({ hideRelationshipAsSpoiler: true })],
            id: "rel-1",
            sourceCharacterId: ALICE,
            targetCharacterId: BOB,
          }),
          linkSource({ id: "rel-2", source: BOB, target: CAROL }),
        ],
        focusCharacterId: ALICE,
        nodes: [nodeSource({ id: ALICE }), nodeSource({ id: BOB }), nodeSource({ id: CAROL })],
      });

      expect(graph.nodes.map((node) => node.id)).toEqual([ALICE]);
      expect(graph.edges).toEqual([]);
      expect(graph.hiddenContent.truncated).toBe(false);
    });

    it("keeps the focused root and a tree connected to it when the node limit is exceeded", () => {
      const graph = build({
        capPolicy: "connected",
        depth: 3,
        edges: [
          linkSource({ id: "rel-1", source: ERIN, target: DAVE }),
          linkSource({ id: "rel-2", source: DAVE, target: ALICE }),
          linkSource({ id: "rel-3", source: DAVE, target: BOB }),
          linkSource({ id: "rel-4", source: ALICE, target: BOB }),
          linkSource({ id: "rel-5", source: ALICE, target: CAROL }),
          linkSource({ id: "rel-6", source: BOB, target: CAROL }),
        ],
        focusCharacterId: ERIN,
        nodeLimit: 3,
        nodes: [ALICE, BOB, CAROL, DAVE, ERIN].map((id) => nodeSource({ id })),
      });

      const keptIds = new Set(graph.nodes.map((node) => node.id));
      expect(keptIds.size).toBe(3);
      expect(keptIds.has(ERIN)).toBe(true);
      expect(keptIds.has(DAVE)).toBe(true);
      expect(reachableFrom({ edges: graph.edges, start: ERIN })).toEqual(keptIds);
      expect(graph.hiddenContent.truncated).toBe(true);
    });

    it("keeps the spanning tree edges before cross-links ordered by id when the edge limit is exceeded", () => {
      const graph = build({
        capPolicy: "connected",
        edgeLimit: 4,
        edges: [
          linkSource({ id: "rel-1", source: BOB, target: CAROL }),
          linkSource({ id: "rel-2", source: CAROL, target: DAVE }),
          linkSource({ id: "rel-7", source: ALICE, target: BOB }),
          linkSource({ id: "rel-8", source: ALICE, target: CAROL }),
          linkSource({ id: "rel-9", source: ALICE, target: DAVE }),
        ],
        focusCharacterId: ALICE,
        nodes: [ALICE, BOB, CAROL, DAVE].map((id) => nodeSource({ id })),
      });

      expect(graph.edges.map((edge) => edge.id)).toEqual(["rel-1", "rel-7", "rel-8", "rel-9"]);
      expect(graph.hiddenContent.truncated).toBe(true);
    });

    it("caps an unfocused network to the same nodes and edges whatever order the sources arrive in", () => {
      const edges = [
        linkSource({ id: "rel-1", source: DAVE, target: ALICE }),
        linkSource({ id: "rel-2", source: DAVE, target: BOB }),
        linkSource({ id: "rel-3", source: DAVE, target: CAROL }),
        linkSource({ id: "rel-4", source: ERIN, target: FRANK }),
      ];
      const nodes = [ALICE, BOB, CAROL, DAVE, ERIN, FRANK].map((id) => nodeSource({ id }));

      const first = build({ capPolicy: "connected", edges, nodeLimit: 3, nodes });
      const second = build({
        capPolicy: "connected",
        edges: [...edges].reverse(),
        nodeLimit: 3,
        nodes: [...nodes].reverse(),
      });

      expect(first.nodes).toHaveLength(3);
      expect(first.hiddenContent.truncated).toBe(true);
      expect(second.nodes.map((node) => node.id)).toEqual(first.nodes.map((node) => node.id));
      expect(second.edges.map((edge) => edge.id)).toEqual(first.edges.map((edge) => edge.id));
    });
  });
});
