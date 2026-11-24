import type { ComponentProps } from "react";

import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { GraphPairSemantics } from "../../model/workspace/graph-person-semantics";
import type { GraphNetworkCharacterConnection } from "./graph-network-character-details";

import {
  makeRelationshipGraphNode,
  RELATIONSHIP_FIXTURE,
} from "../../model/relationships.fixtures";
import { GraphNetworkCharacterDetails } from "./graph-network-character-details";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
}));

const copy = messages.relationships.workspace.networkPanel;

const translate = createTranslator({
  locale: "uk",
  messages,
  namespace: "relationships.workspace",
});

const BOOK_ID = RELATIONSHIP_FIXTURE.book.id;

const NODE = makeRelationshipGraphNode({
  id: "0d0d0d0d-0000-4000-8000-000000000001",
  name: "Arya Stark",
});

const GROUPS = { home: "House Stark", outside: "Brotherhood" } as const;

const SEMANTICS: GraphPairSemantics = {
  direction: { kind: "mixed" },
  relationshipCount: 2,
  singleEdge: null,
  tone: "mixed",
};

const PAIR_LABEL = translate("pair.count", { count: SEMANTICS.relationshipCount });

const CONNECTIONS = Array.from({ length: 6 }, (_, index): GraphNetworkCharacterConnection => ({
  connectionId: `connection-${index + 1}`,
  isOnMap: index < 5,
  other: makeRelationshipGraphNode({
    id: `0d0d0d0d-0000-4000-8000-00000000001${index}`,
    name: `Neighbor ${index + 1}`,
  }),
  otherGroupLabel: index < 5 ? null : GROUPS.outside,
  semantics: SEMANTICS,
}));

const PAIR_OPEN_PREFIX = copy.character.pairs.open.slice(0, copy.character.pairs.open.indexOf("{"));

const SHOW_ALL = translate("networkPanel.list.showAll", { count: CONNECTIONS.length });

const OFF_MAP_PAIR = translate("networkPanel.character.pairs.openOffMap", {
  label: PAIR_LABEL,
  name: translate("networkPanel.character.pairs.nameInGroup", {
    group: GROUPS.outside,
    name: "Neighbor 6",
  }),
});

function onMapPair(name: string): string {
  return translate("networkPanel.character.pairs.open", { label: PAIR_LABEL, name });
}

function pairRows(): HTMLElement[] {
  return screen.getAllByRole("button", { name: (name) => name.startsWith(PAIR_OPEN_PREFIX) });
}

function renderDetails(
  overrides: Partial<ComponentProps<typeof GraphNetworkCharacterDetails>> = {},
) {
  renderWithProviders(
    <GraphNetworkCharacterDetails
      bookId={BOOK_ID}
      connections={CONNECTIONS}
      counts={{ pairsAvailable: 6, pairsOnMap: 2, relationsAvailable: 9 }}
      groupLabel={GROUPS.home}
      node={NODE}
      onExploreAround={vi.fn()}
      onFindPath={vi.fn()}
      onFocusOnMap={vi.fn()}
      onOpenConnection={vi.fn()}
      {...overrides}
    />,
  );
}

describe("GraphNetworkCharacterDetails", () => {
  it("pairs each of the three counters with its own term", () => {
    renderDetails();

    const stats = screen.getByRole("region", { name: copy.character.stats.label });
    expect(
      within(stats)
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual([
      translate("networkPanel.character.stats.pairsOnMap", { count: 2 }),
      translate("networkPanel.character.stats.pairsAvailable", { count: 6 }),
      translate("networkPanel.character.stats.relationsAvailable", { count: 9 }),
    ]);
    expect(
      within(stats)
        .getAllByRole("definition")
        .map((definition) => definition.textContent),
    ).toEqual(["2", "6", "9"]);
  });

  it("names the character's group in a badge", () => {
    renderDetails();

    expect(
      screen.getByText(translate("networkPanel.character.group", { name: GROUPS.home })),
    ).toBeInTheDocument();
  });

  it("shows no group badge for a character without a known group", () => {
    renderDetails({ groupLabel: null });
    const groupPrefix = translate("networkPanel.character.group", { name: "" }).trim();

    expect(screen.queryByText((text) => text.startsWith(groupPrefix))).not.toBeInTheDocument();
  });

  it("focuses the character on the map when asked", async () => {
    const onFocusOnMap = vi.fn();
    renderDetails({ onFocusOnMap });

    await userEvent.click(screen.getByRole("button", { name: copy.character.actions.focus }));

    expect(onFocusOnMap).toHaveBeenCalledOnce();
  });

  it("offers no map focus for a character that is not on the map", () => {
    renderDetails({ onFocusOnMap: null });

    expect(
      screen.queryByRole("button", { name: copy.character.actions.focus }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.character.actions.around })).toBeInTheDocument();
  });

  it("explores the map around the character", async () => {
    const onExploreAround = vi.fn();
    renderDetails({ onExploreAround });

    await userEvent.click(screen.getByRole("button", { name: copy.character.actions.around }));

    expect(onExploreAround).toHaveBeenCalledOnce();
  });

  it("searches a path from the character", async () => {
    const onFindPath = vi.fn();
    renderDetails({ onFindPath });

    await userEvent.click(screen.getByRole("button", { name: copy.character.actions.path }));

    expect(onFindPath).toHaveBeenCalledOnce();
  });

  it("links the character's profile within the book", () => {
    renderDetails();

    expect(screen.getByRole("link", { name: copy.character.actions.profile })).toHaveAttribute(
      "href",
      `/characters/${NODE.id}?bookId=${BOOK_ID}`,
    );
  });

  it("previews the first 5 of 6 pairs and keeps the sixth behind show all", () => {
    renderDetails();

    expect(pairRows()).toHaveLength(5);
    expect(screen.getByRole("button", { name: onMapPair("Neighbor 5") })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: OFF_MAP_PAIR })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: SHOW_ALL })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("marks the pair that is not on the map once all pairs are listed", async () => {
    renderDetails();

    await userEvent.click(screen.getByRole("button", { name: SHOW_ALL }));

    expect(pairRows()).toHaveLength(6);
    expect(
      within(screen.getByRole("button", { name: OFF_MAP_PAIR })).getByText(
        copy.character.pairs.offMap,
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: onMapPair("Neighbor 1") })).queryByText(
        copy.character.pairs.offMap,
      ),
    ).not.toBeInTheDocument();
  });

  it("opens the clicked pair by its connection id", async () => {
    const onOpenConnection = vi.fn();
    renderDetails({ onOpenConnection });

    await userEvent.click(screen.getByRole("button", { name: onMapPair("Neighbor 2") }));

    expect(onOpenConnection).toHaveBeenCalledExactlyOnceWith("connection-2");
  });
});
