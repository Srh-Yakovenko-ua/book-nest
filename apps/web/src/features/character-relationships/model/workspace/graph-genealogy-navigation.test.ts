import type { CharacterGraphNodeView } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { GenealogyExpansion } from "./graph-genealogy-scene";
import type { TreeLineageLink } from "./graph-tree-scene";

import { makeRelationshipGraphNode } from "../relationships.fixtures";
import {
  revealGenealogyCharacter,
  searchGenealogyCharacters,
  toggleGenealogyBranch,
} from "./graph-genealogy-navigation";
import { EMPTY_GENEALOGY_EXPANSION } from "./graph-genealogy-scene";

const KIN = {
  child: "a1a1a1a1-0000-4000-8000-000000000004",
  grandparent: "a1a1a1a1-0000-4000-8000-000000000001",
  outsider: "a1a1a1a1-0000-4000-8000-000000000005",
  outsiderChild: "a1a1a1a1-0000-4000-8000-000000000006",
  parent: "a1a1a1a1-0000-4000-8000-000000000002",
  target: "a1a1a1a1-0000-4000-8000-000000000003",
} as const;

const LINEAGE: TreeLineageLink[] = [
  parentOf(KIN.grandparent, KIN.parent),
  parentOf(KIN.parent, KIN.target),
  parentOf(KIN.target, KIN.child),
  parentOf(KIN.outsider, KIN.outsiderChild),
];

describe("searchGenealogyCharacters", () => {
  it("ranks a name prefix above a word start, and a word start above a match inside a word", () => {
    const nodes = [character(1, "Omar"), character(2, "Anna Maria"), character(3, "Martin")];

    expect(namesFound({ nodes, query: "mar" })).toEqual(["Martin", "Anna Maria", "Omar"]);
  });

  it.each(["EMI", "émi", "ZÓLA"])("ignores case and diacritics for the query '%s'", (query) => {
    const nodes = [character(1, "Émile Zola"), character(2, "Bob Marley")];

    expect(namesFound({ nodes, query })).toEqual(["Émile Zola"]);
  });

  it.each(["", "   "])("finds nothing for the blank query '%s'", (query) => {
    const nodes = [character(1, "Martin")];

    expect(namesFound({ nodes, query })).toEqual([]);
  });

  it("returns at most eight characters", () => {
    const nodes = Array.from({ length: 10 }, (_, index) =>
      character(index + 1, `Arya ${index + 1}`),
    );

    expect(namesFound({ nodes, query: "arya" })).toHaveLength(8);
  });
});

describe("revealGenealogyCharacter", () => {
  it("re-opens only the collapsed ancestors of the revealed character", () => {
    const expansion = collapsing(KIN.grandparent, KIN.parent, KIN.child, KIN.outsider);
    const revealed = revealGenealogyCharacter({ expansion, id: KIN.target, lineage: LINEAGE });

    expect(revealed.collapsedIds).toEqual(new Set([KIN.child, KIN.outsider]));
  });

  it("returns the same expansion when no ancestor of the character is collapsed", () => {
    const expansion = collapsing(KIN.child, KIN.outsider);
    const revealed = revealGenealogyCharacter({ expansion, id: KIN.target, lineage: LINEAGE });

    expect(revealed).toBe(expansion);
  });
});

describe("toggleGenealogyBranch", () => {
  it("collapses an open branch", () => {
    const toggled = toggleGenealogyBranch({ expansion: EMPTY_GENEALOGY_EXPANSION, id: KIN.parent });

    expect(toggled.collapsedIds).toEqual(new Set([KIN.parent]));
  });

  it("re-opens a collapsed branch and leaves the other collapsed branches alone", () => {
    const toggled = toggleGenealogyBranch({
      expansion: collapsing(KIN.parent, KIN.outsider),
      id: KIN.parent,
    });

    expect(toggled.collapsedIds).toEqual(new Set([KIN.outsider]));
  });
});

function character(idSuffix: number, name: string): CharacterGraphNodeView {
  return makeRelationshipGraphNode({
    id: `b1b1b1b1-0000-4000-8000-${String(idSuffix).padStart(12, "0")}`,
    name,
  });
}

function collapsing(...ids: string[]): GenealogyExpansion {
  return { collapsedIds: new Set(ids) };
}

function namesFound({
  nodes,
  query,
}: {
  nodes: readonly CharacterGraphNodeView[];
  query: string;
}): string[] {
  return searchGenealogyCharacters({ nodes, query }).map((node) => node.displayName);
}

function parentOf(parentId: string, childId: string): TreeLineageLink {
  return { childId, edgeId: `${parentId}:${childId}`, kind: "biological", parentId };
}
