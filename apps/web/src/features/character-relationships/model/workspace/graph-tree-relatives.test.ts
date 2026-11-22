import type { FamilyTreeGraphView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { makeRelationshipGraphEdge, makeRelationshipGraphNode } from "../relationships.fixtures";
import { toGraphConnections } from "./graph-connections";
import { toTreePairSemanticsById } from "./graph-tree-pairs";
import { toTreeRelatives } from "./graph-tree-relatives";
import { buildTreeScene, TREE_SCENE } from "./graph-tree-scene";

const CHARACTER = {
  child: { id: "c4c4c4c4-0000-4000-8000-000000000001", name: "Wiktor" },
  conflict: { id: "c4c4c4c4-0000-4000-8000-000000000002", name: "Adam" },
  distant: { id: "c4c4c4c4-0000-4000-8000-000000000003", name: "Taras" },
  exSpouse: { id: "c4c4c4c4-0000-4000-8000-000000000004", name: "Xenia" },
  guardian: { id: "c4c4c4c4-0000-4000-8000-000000000005", name: "Vira" },
  parent: { id: "c4c4c4c4-0000-4000-8000-000000000006", name: "Zenon" },
  parentSpouse: { id: "c4c4c4c4-0000-4000-8000-000000000007", name: "Olha" },
  root: { id: "c4c4c4c4-0000-4000-8000-000000000008", name: "Roman" },
  siblingAnna: { id: "c4c4c4c4-0000-4000-8000-000000000010", name: "Anna" },
  siblingBohdan: { id: "c4c4c4c4-0000-4000-8000-000000000009", name: "Bohdan" },
  spouse: { id: "c4c4c4c4-0000-4000-8000-000000000011", name: "Yaryna" },
} as const;

const EDGE = {
  child: makeRelationshipGraphEdge({
    id: "c5c5c5c5-0000-4000-8000-000000000001",
    source: CHARACTER.root.id,
    target: CHARACTER.child.id,
    type: "biological_parent_of",
  }),
  conflict: makeRelationshipGraphEdge({
    id: "c5c5c5c5-0000-4000-8000-000000000002",
    source: CHARACTER.conflict.id,
    target: CHARACTER.root.id,
    type: "biological_parent_of",
  }),
  distant: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "c5c5c5c5-0000-4000-8000-000000000003",
    source: CHARACTER.root.id,
    target: CHARACTER.distant.id,
    type: "relative_of",
  }),
  exSpouse: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "c5c5c5c5-0000-4000-8000-000000000004",
    source: CHARACTER.root.id,
    target: CHARACTER.exSpouse.id,
    type: "ex_spouse_of",
  }),
  guardian: makeRelationshipGraphEdge({
    id: "c5c5c5c5-0000-4000-8000-000000000005",
    source: CHARACTER.guardian.id,
    target: CHARACTER.root.id,
    type: "guardian_of",
  }),
  parent: makeRelationshipGraphEdge({
    id: "c5c5c5c5-0000-4000-8000-000000000006",
    source: CHARACTER.parent.id,
    target: CHARACTER.root.id,
    type: "biological_parent_of",
  }),
  parentSpouse: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "c5c5c5c5-0000-4000-8000-000000000007",
    source: CHARACTER.parent.id,
    target: CHARACTER.parentSpouse.id,
    type: "spouse_of",
  }),
  siblingAnna: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "c5c5c5c5-0000-4000-8000-000000000008",
    source: CHARACTER.root.id,
    target: CHARACTER.siblingAnna.id,
    type: "sibling_of",
  }),
  siblingBohdan: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "c5c5c5c5-0000-4000-8000-000000000009",
    source: CHARACTER.root.id,
    target: CHARACTER.siblingBohdan.id,
    type: "sibling_of",
  }),
  spouse: makeRelationshipGraphEdge({
    directionality: "symmetric",
    id: "c5c5c5c5-0000-4000-8000-000000000010",
    source: CHARACTER.root.id,
    target: CHARACTER.spouse.id,
    type: "spouse_of",
  }),
};

const TREE: FamilyTreeGraphView = {
  ancestors: 2,
  descendants: 2,
  diagnostics: [],
  edges: Object.values(EDGE),
  focusCharacterId: CHARACTER.root.id,
  graphVersion: "tree-v1",
  hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: false },
  lineage: [
    {
      childId: CHARACTER.root.id,
      kind: "biological",
      parentId: CHARACTER.parent.id,
      relationshipId: EDGE.parent.id,
    },
    {
      childId: CHARACTER.child.id,
      kind: "biological",
      parentId: CHARACTER.root.id,
      relationshipId: EDGE.child.id,
    },
  ],
  nodes: Object.values(CHARACTER).map((character) => makeRelationshipGraphNode(character)),
  projection: "family_tree",
  updatedAt: null,
};

describe("toTreeRelatives", () => {
  it("orders relatives by kind from parents down to conflicts", () => {
    expect(relativeIdsOf(CHARACTER.root.id)).toEqual([
      CHARACTER.parent.id,
      CHARACTER.spouse.id,
      CHARACTER.exSpouse.id,
      CHARACTER.siblingAnna.id,
      CHARACTER.siblingBohdan.id,
      CHARACTER.child.id,
      CHARACTER.guardian.id,
      CHARACTER.distant.id,
      CHARACTER.conflict.id,
    ]);
  });

  it("orders relatives of the same kind by name", () => {
    const siblingIds: readonly string[] = [CHARACTER.siblingAnna.id, CHARACTER.siblingBohdan.id];
    const siblings = relativeIdsOf(CHARACTER.root.id).filter((id) => siblingIds.includes(id));

    expect(siblings).toEqual([CHARACTER.siblingAnna.id, CHARACTER.siblingBohdan.id]);
  });

  it("lists only the pairs that touch the character", () => {
    expect(relativeIdsOf(CHARACTER.parent.id)).toEqual([
      CHARACTER.parentSpouse.id,
      CHARACTER.root.id,
    ]);
  });
});

function relativeIdsOf(characterId: string): string[] {
  const scene = buildTreeScene({
    options: { ...TREE_SCENE.defaultOptions, exUnions: true },
    tree: TREE,
  });
  const connections = toGraphConnections(scene.edges);
  const nameById = new Map(TREE.nodes.map((node) => [node.id, node.name] as const));
  return toTreeRelatives({
    characterId,
    connections,
    nameOf: (id) => nameById.get(id) ?? "",
    pairs: toTreePairSemanticsById({ connections, entryByEdgeId: scene.entryByEdgeId }),
  }).map((relative) => relative.otherId);
}
