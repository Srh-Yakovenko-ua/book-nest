import type { CharacterRelationshipPathView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { RelationshipGraphPathQuery } from "./relationship-graph-path";

import {
  toRelationshipGraphEmphasis,
  toRelationshipGraphPathRequest,
  toRelationshipGraphPathState,
  toVisibleRelationshipGraphEndpoints,
} from "./relationship-graph-path";
import {
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
  RELATIONSHIP_FIXTURE,
} from "./relationships.fixtures";

const { ciri: CIRI, geralt: GERALT, yennefer: YENNEFER } = RELATIONSHIP_FIXTURE;

const CONTEXT_BOOK_ID = RELATIONSHIP_FIXTURE.book.id;

const QUERY: RelationshipGraphPathQuery = {
  contextBookId: CONTEXT_BOOK_ID,
  filters: { categories: ["family"], mode: "all", relationshipTypes: [] },
  fromId: GERALT.id,
  toId: YENNEFER.id,
};

const PATH_NODES = [
  makeRelationshipGraphNode(),
  makeRelationshipGraphNode(CIRI),
  makeRelationshipGraphNode(YENNEFER),
];

const FOUND_PATH: CharacterRelationshipPathView = {
  edges: [
    makeRelationshipGraphEdge({ id: "rel-1", source: GERALT.id, target: CIRI.id }),
    makeRelationshipGraphEdge({ id: "rel-2", source: CIRI.id, target: YENNEFER.id }),
  ],
  found: true,
  fromId: GERALT.id,
  nodes: PATH_NODES,
  toId: YENNEFER.id,
};

const NO_PATH: CharacterRelationshipPathView = {
  edges: [],
  found: false,
  fromId: GERALT.id,
  nodes: [],
  toId: YENNEFER.id,
};

describe("toRelationshipGraphPathRequest", () => {
  it("carries the reading context, both characters and the graph filters", () => {
    expect(toRelationshipGraphPathRequest(QUERY)).toEqual({
      contextBookId: CONTEXT_BOOK_ID,
      filters: { categories: ["family"], mode: "all", relationshipTypes: [] },
      fromId: GERALT.id,
      toId: YENNEFER.id,
    });
  });

  it.each<[string, Partial<RelationshipGraphPathQuery>]>([
    ["no reading context", { contextBookId: null }],
    ["no starting character", { fromId: null }],
    ["no target character", { toId: null }],
    ["the same character at both ends", { toId: GERALT.id }],
  ])("asks nothing with %s", (_case, overrides) => {
    expect(toRelationshipGraphPathRequest({ ...QUERY, ...overrides })).toBeNull();
  });
});

describe("toRelationshipGraphPathState", () => {
  it("collects the characters and relationships of a found path for highlighting", () => {
    expect(
      toRelationshipGraphPathState({ path: { data: FOUND_PATH, isError: false }, query: QUERY }),
    ).toEqual({
      edgeIds: new Set(["rel-1", "rel-2"]),
      kind: "found",
      nodeIds: new Set([CIRI.id, GERALT.id, YENNEFER.id]),
      steps: PATH_NODES,
    });
  });

  it.each<[string, Parameters<typeof toRelationshipGraphPathState>[0]]>([
    [
      "unavailable",
      { path: { data: FOUND_PATH, isError: false }, query: { ...QUERY, contextBookId: null } },
    ],
    ["idle", { path: { data: undefined, isError: false }, query: { ...QUERY, toId: null } }],
    [
      "sameCharacter",
      { path: { data: undefined, isError: false }, query: { ...QUERY, toId: GERALT.id } },
    ],
    ["error", { path: { data: FOUND_PATH, isError: true }, query: QUERY }],
    ["loading", { path: { data: undefined, isError: false }, query: QUERY }],
    ["notFound", { path: { data: NO_PATH, isError: false }, query: QUERY }],
  ])("reports the search as %s", (kind, input) => {
    expect(toRelationshipGraphPathState(input)).toEqual({ kind });
  });
});

describe("toRelationshipGraphEmphasis", () => {
  it("leaves every element plain while no path is shown", () => {
    expect(toRelationshipGraphEmphasis({ highlighted: null, id: CIRI.id })).toBe("default");
  });

  it("highlights the members of the path", () => {
    expect(
      toRelationshipGraphEmphasis({ highlighted: new Set([CIRI.id, GERALT.id]), id: CIRI.id }),
    ).toBe("path");
  });

  it("dims everything off the path", () => {
    expect(
      toRelationshipGraphEmphasis({ highlighted: new Set([CIRI.id, GERALT.id]), id: YENNEFER.id }),
    ).toBe("dimmed");
  });
});

describe("toVisibleRelationshipGraphEndpoints", () => {
  it("forgets an endpoint whose character is no longer on the graph", () => {
    expect(
      toVisibleRelationshipGraphEndpoints({
        endpoints: { fromId: GERALT.id, toId: YENNEFER.id },
        nodeIds: new Set([CIRI.id, GERALT.id]),
      }),
    ).toEqual({ fromId: GERALT.id, toId: null });
  });
});
