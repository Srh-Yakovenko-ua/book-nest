import type { FamilyTreeGraphView } from "@app/shared";
import type { ComponentProps } from "react";

import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { GraphPresentationCharacter } from "../../model/workspace/graph-workspace-presentation";

import {
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
} from "../../model/relationships.fixtures";
import { toGraphConnections } from "../../model/workspace/graph-connections";
import { toGraphPairEntries } from "../../model/workspace/graph-person-semantics";
import { toTreePairSemanticsById } from "../../model/workspace/graph-tree-pairs";
import { buildTreeScene, TREE_SCENE } from "../../model/workspace/graph-tree-scene";
import { GraphTreeConnectionsList } from "./graph-tree-connections-list";

const copy = messages.relationships.workspace;

const translateWorkspace = createTranslator({
  locale: "uk",
  messages,
  namespace: "relationships.workspace",
});

const ROOT = makeRelationshipGraphNode({ id: "f0f0f0f0-0000-4000-8000-000000000000", name: "Ash" });

const TWICE_LINKED = makeRelationshipGraphNode({
  id: "b0b0b0b0-0000-4000-8000-000000000000",
  name: "Alder",
});

const SIBLINGS = [
  { idPrefix: "b1b1b1b1", name: "Brother" },
  { idPrefix: "b2b2b2b2", name: "Sister" },
].flatMap(({ idPrefix, name }) =>
  Array.from({ length: 12 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return makeRelationshipGraphNode({
      id: `${idPrefix}-0000-4000-8000-0000000000${number}`,
      name: `${name} ${number}`,
    });
  }),
);

const TREE: FamilyTreeGraphView = {
  ancestors: 2,
  descendants: 2,
  diagnostics: [],
  edges: [
    makeRelationshipGraphEdge({
      directionality: "symmetric",
      id: "d0d0d0d0-0000-4000-8000-000000000001",
      source: ROOT.id,
      target: TWICE_LINKED.id,
      type: "spouse_of",
    }),
    makeRelationshipGraphEdge({
      directionality: "symmetric",
      id: "d0d0d0d0-0000-4000-8000-000000000002",
      source: ROOT.id,
      target: TWICE_LINKED.id,
      type: "sibling_of",
    }),
    ...SIBLINGS.map((sibling, index) =>
      makeRelationshipGraphEdge({
        directionality: "symmetric",
        id: `e0e0e0e0-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        source: ROOT.id,
        target: sibling.id,
        type: "sibling_of",
      }),
    ),
  ],
  focusCharacterId: ROOT.id,
  graphVersion: "tree-v1",
  hiddenContent: { hasHiddenEdges: false, hasLockedEdges: false, truncated: false },
  lineage: [],
  nodes: [ROOT, TWICE_LINKED, ...SIBLINGS],
  projection: "family_tree",
  updatedAt: null,
};

const SCENE = buildTreeScene({ options: TREE_SCENE.defaultOptions, tree: TREE });

const CONNECTIONS = toGraphConnections(SCENE.edges);

const CHARACTERS = new Map(
  SCENE.nodes.map((node): [string, GraphPresentationCharacter] => [
    node.id,
    { canCollapse: false, canExpand: false, hop: null, isRoot: node.id === ROOT.id, node },
  ]),
);

const ENTRIES = toGraphPairEntries({ connections: CONNECTIONS, nameOf, rootId: ROOT.id });

const PAIRS = toTreePairSemanticsById({
  connections: CONNECTIONS,
  entryByEdgeId: SCENE.entryByEdgeId,
});

function cardOf(name: string) {
  return screen.getByRole("button", { name: new RegExp(name) });
}

function nameOf(id: string): string {
  return CHARACTERS.get(id)?.node.displayName ?? "";
}

function renderList(overrides: Partial<ComponentProps<typeof GraphTreeConnectionsList>> = {}) {
  renderWithProviders(
    <GraphTreeConnectionsList
      characters={CHARACTERS}
      entries={ENTRIES}
      id="tree-connections"
      onConnectionOpen={vi.fn()}
      pairs={PAIRS}
      relationships={SCENE.edges.length}
      selectedId={null}
      widthClass="compact"
      {...overrides}
    />,
  );
}

function searchBox() {
  return screen.getByRole("searchbox", { name: copy.personList.search });
}

function showMoreButton(count: number) {
  return screen.getByRole("button", { name: translateWorkspace("personList.showMore", { count }) });
}

function shownCards() {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

describe("GraphTreeConnectionsList", () => {
  it("shows the first 10 of 25 pairs and offers the next 10", () => {
    renderList();

    expect(shownCards()).toHaveLength(10);
    expect(cardOf("Brother 09")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Brother 10/ })).not.toBeInTheDocument();
    expect(showMoreButton(10)).toBeInTheDocument();
  });

  it("reveals the next 10 pairs on show more and offers the remaining 5", async () => {
    renderList();

    await userEvent.click(showMoreButton(10));

    expect(shownCards()).toHaveLength(20);
    expect(cardOf("Sister 07")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sister 08/ })).not.toBeInTheDocument();
    expect(showMoreButton(5)).toBeInTheDocument();
  });

  it("finds pairs by the name of the other character", async () => {
    renderList();

    await userEvent.type(searchBox(), "Sister");

    expect(shownCards()).toHaveLength(10);
    expect(cardOf("Sister 01")).toBeInTheDocument();
    expect(cardOf("Sister 10")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Brother/ })).not.toBeInTheDocument();
    expect(showMoreButton(2)).toBeInTheDocument();
  });

  it("finds pairs by the name of the central character", async () => {
    renderList();

    await userEvent.type(searchBox(), ROOT.name);

    expect(shownCards()).toHaveLength(10);
    expect(cardOf(TWICE_LINKED.name)).toBeInTheDocument();
    expect(showMoreButton(10)).toBeInTheDocument();
  });

  it("restores every pair once the search is cleared", async () => {
    renderList();
    await userEvent.type(searchBox(), "Sister 03");
    expect(shownCards()).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: copy.personList.clearSearch }));

    expect(searchBox()).toHaveValue("");
    expect(shownCards()).toHaveLength(10);
    expect(cardOf(TWICE_LINKED.name)).toBeInTheDocument();
    expect(showMoreButton(10)).toBeInTheDocument();
  });

  it("shows two relationships between the same pair as one card with both labels", () => {
    renderList();

    expect(screen.getAllByRole("button", { name: new RegExp(TWICE_LINKED.name) })).toHaveLength(1);
    const card = cardOf(TWICE_LINKED.name);
    expect(within(card).getByText(messages.relationships.types.spouse_of)).toBeInTheDocument();
    expect(within(card).getByText(messages.relationships.types.sibling_of)).toBeInTheDocument();
    expect(
      within(card).getByText(copy.tree.list.multi.replace("{count}", "2")),
    ).toBeInTheDocument();
  });

  it("shows no count badge on a pair linked once", () => {
    renderList();

    expect(
      within(cardOf("Brother 01")).queryByText(
        new RegExp(`^${copy.tree.list.multi.replace("{count}", "\\d+")}$`),
      ),
    ).not.toBeInTheDocument();
  });

  it("opens the clicked pair by its pair id", async () => {
    const onConnectionOpen = vi.fn();
    renderList({ onConnectionOpen });

    await userEvent.click(cardOf("Brother 03"));

    expect(onConnectionOpen).toHaveBeenCalledExactlyOnceWith(
      "pair:b1b1b1b1-0000-4000-8000-000000000003:f0f0f0f0-0000-4000-8000-000000000000",
    );
  });

  it("counts pairs and relationships separately", () => {
    renderList();

    expect(
      screen.getByText(translateWorkspace("tree.list.counts", { pairs: 25, relationships: 26 })),
    ).toBeInTheDocument();
  });
});
