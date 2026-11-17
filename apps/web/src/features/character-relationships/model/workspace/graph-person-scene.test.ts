import type { CharacterGraphEdgeView, CharacterGraphNodeView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { PersonExpansion } from "./graph-person-scene";

import { makeRelationshipGraphEdge, makeRelationshipGraphNode } from "../relationships.fixtures";
import {
  buildPersonScene,
  EMPTY_PERSON_EXPANSION,
  withPersonBranch,
  withPersonMore,
} from "./graph-person-scene";

const CHARACTER = {
  hub: "a0a0a0a0-0000-4000-8000-000000000002",
  left: "a0a0a0a0-0000-4000-8000-000000000003",
  right: "a0a0a0a0-0000-4000-8000-000000000004",
  root: "a0a0a0a0-0000-4000-8000-000000000001",
} as const;

describe("buildPersonScene", () => {
  it("shows the root alone when it has no relationships", () => {
    const scene = buildPersonScene({
      edges: [],
      expansion: EMPTY_PERSON_EXPANSION,
      nodes: toNodes([CHARACTER.root, CHARACTER.hub]),
      rootId: CHARACTER.root,
    });

    expect(scene?.nodes.map((node) => node.id)).toEqual([CHARACTER.root]);
  });

  it("shows twelve neighbours on the first ring and reports more when there are thirteen", () => {
    const scene = starScene(13, EMPTY_PERSON_EXPANSION);

    expect(scene?.nodes).toHaveLength(13);
    expect(scene?.moreByHop).toEqual(new Set([1]));
  });

  it("reports nothing more when all twelve neighbours fit the first ring", () => {
    const scene = starScene(12, EMPTY_PERSON_EXPANSION);

    expect(scene?.nodes).toHaveLength(13);
    expect(scene?.moreByHop).toEqual(new Set());
  });

  it("shows eight characters on the second ring by default and reports more", () => {
    const scene = hubScene(9, EMPTY_PERSON_EXPANSION);

    expect(scene?.nodes).toHaveLength(10);
    expect(scene?.moreByHop).toEqual(new Set([2]));
  });

  it("widens a ring once the reader asks for more of it", () => {
    const scene = starScene(13, withPersonMore({ expansion: EMPTY_PERSON_EXPANSION, hop: 1 }));

    expect(scene?.nodes).toHaveLength(14);
    expect(scene?.moreByHop).toEqual(new Set());
  });

  it("shows every next-ring neighbour of an expanded character", () => {
    const expansion = withPersonBranch({
      expansion: EMPTY_PERSON_EXPANSION,
      nodeId: CHARACTER.hub,
      state: "expanded",
    });

    expect(hubScene(9, expansion)?.nodes).toHaveLength(11);
  });

  it("hides the next-ring neighbours of a collapsed character", () => {
    const expansion = withPersonBranch({
      expansion: EMPTY_PERSON_EXPANSION,
      nodeId: CHARACTER.hub,
      state: "collapsed",
    });
    const scene = hubScene(2, expansion);

    expect(new Set(scene?.nodes.map((node) => node.id))).toEqual(
      new Set([CHARACTER.hub, CHARACTER.root]),
    );
  });

  it("keeps a relationship between two shown neighbours", () => {
    const edges = toEdges([
      [CHARACTER.root, CHARACTER.left],
      [CHARACTER.root, CHARACTER.right],
      [CHARACTER.left, CHARACTER.right],
    ]);
    const scene = buildPersonScene({
      edges,
      expansion: EMPTY_PERSON_EXPANSION,
      nodes: toNodes([CHARACTER.root, CHARACTER.left, CHARACTER.right]),
      rootId: CHARACTER.root,
    });

    expect(scene?.edges).toEqual(edges);
  });

  it("builds no scene when the root is not in the graph", () => {
    const scene = buildPersonScene({
      edges: [],
      expansion: EMPTY_PERSON_EXPANSION,
      nodes: toNodes([CHARACTER.hub]),
      rootId: CHARACTER.root,
    });

    expect(scene).toBeNull();
  });
});

function characterIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const suffix = String(index + 1).padStart(12, "0");
    return `b0b0b0b0-0000-4000-8000-${suffix}`;
  });
}

function hubScene(childCount: number, expansion: PersonExpansion) {
  const childIds = characterIds(childCount);
  return buildPersonScene({
    edges: toEdges([
      [CHARACTER.root, CHARACTER.hub],
      ...childIds.map((id) => [CHARACTER.hub, id] as const),
    ]),
    expansion,
    nodes: toNodes([CHARACTER.root, CHARACTER.hub, ...childIds]),
    rootId: CHARACTER.root,
  });
}

function starScene(neighbourCount: number, expansion: PersonExpansion) {
  const neighbourIds = characterIds(neighbourCount);
  return buildPersonScene({
    edges: toEdges(neighbourIds.map((id) => [CHARACTER.root, id] as const)),
    expansion,
    nodes: toNodes([CHARACTER.root, ...neighbourIds]),
    rootId: CHARACTER.root,
  });
}

function toEdges(pairs: readonly (readonly [string, string])[]): CharacterGraphEdgeView[] {
  return pairs.map(([source, target], index) => {
    const suffix = String(index + 1).padStart(12, "0");
    return makeRelationshipGraphEdge({ id: `e0e0e0e0-0000-4000-8000-${suffix}`, source, target });
  });
}

function toNodes(ids: readonly string[]): CharacterGraphNodeView[] {
  return ids.map((id) => makeRelationshipGraphNode({ id }));
}
