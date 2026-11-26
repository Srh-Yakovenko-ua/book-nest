import type { ComponentProps } from "react";

import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type {
  GraphPairEntry,
  GraphPairSemantics,
} from "../../model/workspace/graph-person-semantics";
import type { GraphPresentationCharacter } from "../../model/workspace/graph-workspace-presentation";

import {
  makeRelationshipGraphEdge,
  makeRelationshipGraphNode,
} from "../../model/relationships.fixtures";
import { GraphPersonConnectionsList } from "./graph-person-connections-list";

const copy = messages.relationships.workspace.personList;

const translateList = createTranslator({
  locale: "uk",
  messages,
  namespace: "relationships.workspace.personList",
});

const ROOT = makeRelationshipGraphNode();

const OTHERS = [
  ...Array.from({ length: 13 }, (_, index) => `Witcher ${String(index + 1).padStart(2, "0")}`),
  ...Array.from({ length: 12 }, (_, index) => `Sorceress ${String(index + 1).padStart(2, "0")}`),
].map((name, index) => makeRelationshipGraphNode({ id: `character-${index}`, name }));

const ENTRIES = OTHERS.map((other, index): GraphPairEntry => ({
  connection: {
    direction: { kind: "symmetric" },
    edgeIds: [`edge-${index}`],
    hasMaskedSemantics: false,
    id: `connection-${index}`,
    sourceId: ROOT.id,
    targetId: other.id,
  },
  firstId: ROOT.id,
  involvesRoot: true,
  secondId: other.id,
}));

const CHARACTERS = new Map(
  [ROOT, ...OTHERS].map((node): [string, GraphPresentationCharacter] => [
    node.id,
    { canCollapse: false, canExpand: false, hop: null, isRoot: node.id === ROOT.id, node },
  ]),
);

const SEMANTICS = new Map(
  ENTRIES.map((entry, index): [string, GraphPairSemantics] => [
    entry.connection.id,
    {
      direction: entry.connection.direction,
      relationshipCount: 1,
      singleEdge: makeRelationshipGraphEdge({
        id: `edge-${index}`,
        source: entry.firstId,
        target: entry.secondId,
      }),
      tone: "family",
    },
  ]),
);

function cardOf(name: string) {
  return screen.getByRole("button", { name: new RegExp(name) });
}

function renderList(overrides: Partial<ComponentProps<typeof GraphPersonConnectionsList>> = {}) {
  renderWithProviders(
    <GraphPersonConnectionsList
      characters={CHARACTERS}
      entries={ENTRIES}
      id="person-connections"
      onConnectionOpen={vi.fn()}
      relationships={ENTRIES.length}
      selectedId={null}
      semantics={SEMANTICS}
      widthClass="compact"
      {...overrides}
    />,
  );
}

function showMoreButton(count: number) {
  return screen.getByRole("button", { name: translateList("showMore", { count }) });
}

function shownCards() {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GraphPersonConnectionsList", () => {
  it("shows the first 10 of 25 pairs and offers the next 10", () => {
    renderList();

    expect(shownCards()).toHaveLength(10);
    expect(cardOf("Witcher 10")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Witcher 11/ })).not.toBeInTheDocument();
    expect(showMoreButton(10)).toBeInTheDocument();
  });

  it("offers no collapse button before the list is expanded", () => {
    renderList();

    expect(screen.queryByRole("button", { name: copy.showLess })).not.toBeInTheDocument();
  });

  it("reveals 20 pairs after one show-more click and offers the remaining 5", async () => {
    renderList();

    await userEvent.click(showMoreButton(10));

    expect(shownCards()).toHaveLength(20);
    expect(cardOf("Sorceress 07")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sorceress 08/ })).not.toBeInTheDocument();
    expect(showMoreButton(5)).toBeInTheDocument();
  });

  it("puts the collapse button in the header ahead of the pair cards once expanded", async () => {
    renderList();

    await userEvent.click(showMoreButton(10));

    const [firstButton] = screen.getAllByRole("button");
    expect(firstButton).toHaveAccessibleName(copy.showLess);
  });

  it("reveals all 25 pairs on the second click and drops the show-more button", async () => {
    renderList();

    await userEvent.click(showMoreButton(10));
    await userEvent.click(showMoreButton(5));

    expect(shownCards()).toHaveLength(25);
    expect(screen.getAllByRole("button")).toHaveLength(26);
    expect(screen.getByRole("button", { name: copy.showLess })).toBeInTheDocument();
  });

  it("returns to the first 10 pairs when collapsed", async () => {
    renderList();

    await userEvent.click(showMoreButton(10));
    await userEvent.click(showMoreButton(5));
    await userEvent.click(screen.getByRole("button", { name: copy.showLess }));

    expect(shownCards()).toHaveLength(10);
    expect(screen.queryByRole("button", { name: /Witcher 11/ })).not.toBeInTheDocument();
    expect(showMoreButton(10)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.showLess })).not.toBeInTheDocument();
  });

  it("filters pairs by character name locally without calling back or fetching", async () => {
    const onConnectionOpen = vi.fn();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderList({ onConnectionOpen });

    await userEvent.type(screen.getByRole("searchbox", { name: copy.search }), "Sorceress");

    expect(shownCards()).toHaveLength(10);
    expect(cardOf("Sorceress 01")).toBeInTheDocument();
    expect(cardOf("Sorceress 10")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Witcher/ })).not.toBeInTheDocument();
    expect(showMoreButton(2)).toBeInTheDocument();
    expect(onConnectionOpen).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("resets an expanded list to the first 10 matches when the search changes", async () => {
    renderList();

    await userEvent.click(showMoreButton(10));
    await userEvent.type(screen.getByRole("searchbox", { name: copy.search }), "Sorceress");

    expect(shownCards()).toHaveLength(10);
    expect(screen.queryByRole("button", { name: /Sorceress 11/ })).not.toBeInTheDocument();
    expect(showMoreButton(2)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.showLess })).not.toBeInTheDocument();
  });

  it("reports when no shown pair matches the search", async () => {
    renderList();

    await userEvent.type(screen.getByRole("searchbox", { name: copy.search }), "Yarpen");

    expect(screen.getByRole("status")).toHaveTextContent(copy.noMatches);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("opens the clicked pair by its connection id", async () => {
    const onConnectionOpen = vi.fn();
    renderList({ onConnectionOpen });

    await userEvent.click(cardOf("Witcher 03"));

    expect(onConnectionOpen).toHaveBeenCalledExactlyOnceWith("connection-2");
  });

  it("marks only the selected pair as current", () => {
    renderList({ selectedId: "connection-4" });

    expect(cardOf("Witcher 05")).toHaveAttribute("aria-current", "true");
    expect(cardOf("Witcher 04")).not.toHaveAttribute("aria-current");
  });
});
