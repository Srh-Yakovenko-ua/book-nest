import type { CharacterGraphEdgeView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { makeRelationshipGraphEdge } from "../relationships.fixtures";
import { toGraphConnections } from "./graph-connections";

const CHARACTER = {
  alpha: "11111111-1111-4111-8111-111111111111",
  beta: "22222222-2222-4222-8222-222222222222",
  gamma: "33333333-3333-4333-8333-333333333333",
} as const;

const RELATIONSHIP = {
  first: "e1e1e1e1-0000-4000-8000-000000000001",
  second: "e2e2e2e2-0000-4000-8000-000000000002",
  third: "e3e3e3e3-0000-4000-8000-000000000003",
} as const;

describe("toGraphConnections", () => {
  it("joins the raw edges of one unordered pair into one connection with their ids sorted", () => {
    const connections = toGraphConnections([
      directedEdge(RELATIONSHIP.second, CHARACTER.alpha, CHARACTER.beta),
      directedEdge(RELATIONSHIP.third, CHARACTER.alpha, CHARACTER.gamma),
      directedEdge(RELATIONSHIP.first, CHARACTER.beta, CHARACTER.alpha),
    ]);

    expect(connections).toHaveLength(2);
    expect(connections.map((connection) => connection.edgeIds)).toEqual(
      expect.arrayContaining([[RELATIONSHIP.first, RELATIONSHIP.second], [RELATIONSHIP.third]]),
    );
  });

  it("reports a pair whose edges all run the same way as directed from that source", () => {
    const connections = toGraphConnections([
      directedEdge(RELATIONSHIP.first, CHARACTER.beta, CHARACTER.alpha),
      directedEdge(RELATIONSHIP.second, CHARACTER.beta, CHARACTER.alpha),
    ]);

    expect(connections.map((connection) => connection.direction)).toEqual([
      { kind: "directed", sourceId: CHARACTER.beta, targetId: CHARACTER.alpha },
    ]);
  });

  it("reports a pair whose edges are all symmetric as symmetric", () => {
    const connections = toGraphConnections([
      symmetricEdge(RELATIONSHIP.first, CHARACTER.alpha, CHARACTER.beta),
      symmetricEdge(RELATIONSHIP.second, CHARACTER.beta, CHARACTER.alpha),
    ]);

    expect(connections.map((connection) => connection.direction)).toEqual([{ kind: "symmetric" }]);
  });

  it.each<{ edges: CharacterGraphEdgeView[]; label: string }>([
    {
      edges: [
        directedEdge(RELATIONSHIP.first, CHARACTER.alpha, CHARACTER.beta),
        directedEdge(RELATIONSHIP.second, CHARACTER.beta, CHARACTER.alpha),
      ],
      label: "its edges run in opposite directions",
    },
    {
      edges: [
        directedEdge(RELATIONSHIP.first, CHARACTER.alpha, CHARACTER.beta),
        symmetricEdge(RELATIONSHIP.second, CHARACTER.alpha, CHARACTER.beta),
      ],
      label: "directed and symmetric edges mix",
    },
    {
      edges: [
        makeRelationshipGraphEdge({
          id: RELATIONSHIP.first,
          source: CHARACTER.alpha,
          target: CHARACTER.beta,
          typeHidden: true,
        }),
      ],
      label: "an edge hides its type",
    },
    {
      edges: [
        makeRelationshipGraphEdge({
          directionality: null,
          id: RELATIONSHIP.first,
          source: CHARACTER.alpha,
          target: CHARACTER.beta,
        }),
      ],
      label: "an edge has no directionality",
    },
  ])("reports a mixed direction when $label", ({ edges }) => {
    expect(toGraphConnections(edges).map((connection) => connection.direction)).toEqual([
      { kind: "mixed" },
    ]);
  });

  it.each<{ edge: CharacterGraphEdgeView; label: string; masked: boolean }>([
    {
      edge: makeRelationshipGraphEdge({
        id: RELATIONSHIP.second,
        source: CHARACTER.alpha,
        target: CHARACTER.beta,
        typeHidden: true,
      }),
      label: "hides its type",
      masked: true,
    },
    {
      edge: makeRelationshipGraphEdge({
        id: RELATIONSHIP.second,
        source: CHARACTER.alpha,
        target: CHARACTER.beta,
        type: null,
      }),
      label: "has no type",
      masked: true,
    },
    {
      edge: directedEdge(RELATIONSHIP.second, CHARACTER.beta, CHARACTER.alpha),
      label: "is fully known",
      masked: false,
    },
  ])("reports masked semantics as $masked when one edge of the pair $label", ({ edge, masked }) => {
    const connections = toGraphConnections([
      directedEdge(RELATIONSHIP.first, CHARACTER.alpha, CHARACTER.beta),
      edge,
    ]);

    expect(connections.map((connection) => connection.hasMaskedSemantics)).toEqual([masked]);
  });

  it("ignores self-loops", () => {
    const connections = toGraphConnections([
      directedEdge(RELATIONSHIP.first, CHARACTER.alpha, CHARACTER.alpha),
      directedEdge(RELATIONSHIP.second, CHARACTER.alpha, CHARACTER.beta),
    ]);

    expect(connections.map((connection) => connection.edgeIds)).toEqual([[RELATIONSHIP.second]]);
  });
});

function directedEdge(id: string, source: string, target: string): CharacterGraphEdgeView {
  return makeRelationshipGraphEdge({ directionality: "directed", id, source, target });
}

function symmetricEdge(id: string, source: string, target: string): CharacterGraphEdgeView {
  return makeRelationshipGraphEdge({
    category: "social",
    directionality: "symmetric",
    id,
    source,
    target,
    type: "friend_of",
  });
}
