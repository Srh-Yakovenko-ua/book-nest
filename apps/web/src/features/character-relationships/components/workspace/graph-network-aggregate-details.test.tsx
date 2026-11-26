import type { ComponentProps } from "react";

import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { GraphPairSemantics } from "../../model/workspace/graph-person-semantics";
import type { GraphNetworkAggregatePair } from "./graph-network-aggregate-details";

import { makeRelationshipGraphNode } from "../../model/relationships.fixtures";
import { GraphNetworkAggregateDetails } from "./graph-network-aggregate-details";

const copy = messages.relationships.workspace.networkPanel;

const categoryNames = messages.relationships.categories;

const translate = createTranslator({
  locale: "uk",
  messages,
  namespace: "relationships.workspace",
});

const SIDES = { source: "House Stark", target: "House Lannister" } as const;

const LINK = { edgeCount: 14, pairCount: 7 } as const;

const SEMANTICS: GraphPairSemantics = {
  direction: { kind: "mixed" },
  relationshipCount: 2,
  singleEdge: null,
  tone: "mixed",
};

const PAIRS = Array.from({ length: LINK.pairCount }, (_, index): GraphNetworkAggregatePair => ({
  connectionId: `connection-${index + 1}`,
  first: makeRelationshipGraphNode({
    id: `0c0c0c0c-0000-4000-8000-00000000001${index}`,
    name: `Stark ${index + 1}`,
  }),
  second: makeRelationshipGraphNode({
    id: `0c0c0c0c-0000-4000-8000-00000000002${index}`,
    name: `Lannister ${index + 1}`,
  }),
  semantics: SEMANTICS,
}));

const EXPLORE_PREFIX = copy.aggregate.explore.slice(0, copy.aggregate.explore.indexOf("{"));

const PAIR_OPEN_PREFIX = copy.aggregate.pairs.open.slice(0, copy.aggregate.pairs.open.indexOf("{"));

const SHOW_ALL = translate("networkPanel.list.showAll", { count: LINK.pairCount });

function categoryCount(count: number): string {
  return translate("networkPanel.aggregate.categories.count", { count });
}

function exploreActions(): HTMLElement[] {
  return screen.getAllByRole("button", { name: (name) => name.startsWith(EXPLORE_PREFIX) });
}

function exploreName(group: string): string {
  return translate("networkPanel.aggregate.explore", { group });
}

function pairName(number: number): string {
  return translate("networkPanel.aggregate.pairs.open", {
    label: translate("pair.count", { count: SEMANTICS.relationshipCount }),
    names: translate("networkPanel.aggregate.pairs.names", {
      first: `Stark ${number}`,
      second: `Lannister ${number}`,
    }),
  });
}

function pairRows(): HTMLElement[] {
  return screen.getAllByRole("button", { name: (name) => name.startsWith(PAIR_OPEN_PREFIX) });
}

function renderDetails(
  overrides: Partial<ComponentProps<typeof GraphNetworkAggregateDetails>> = {},
) {
  renderWithProviders(
    <GraphNetworkAggregateDetails
      categories={[
        { category: "family", count: 8 },
        { category: "social", count: 4 },
      ]}
      edgeCount={LINK.edgeCount}
      explore={[
        { label: SIDES.source, onExplore: vi.fn() },
        { label: SIDES.target, onExplore: vi.fn() },
      ]}
      hasMaskedDetails
      onOpenConnection={vi.fn()}
      pairCount={LINK.pairCount}
      pairs={PAIRS}
      sourceLabel={SIDES.source}
      targetLabel={SIDES.target}
      {...overrides}
    />,
  );
}

describe("GraphNetworkAggregateDetails", () => {
  it("names both groups of the link in its heading", () => {
    renderDetails();

    expect(
      screen.getByRole("heading", { name: translate("networkPanel.aggregate.title", SIDES) }),
    ).toBeInTheDocument();
  });

  it("counts relation records and unique pairs as two separately labelled numbers", () => {
    renderDetails();

    const stats = screen.getByRole("region", { name: copy.aggregate.stats.label });
    expect(
      within(stats)
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual([
      translate("networkPanel.aggregate.stats.relations", { count: LINK.edgeCount }),
      translate("networkPanel.aggregate.stats.pairs", { count: LINK.pairCount }),
    ]);
    expect(
      within(stats)
        .getAllByRole("definition")
        .map((definition) => definition.textContent),
    ).toEqual(["14", "7"]);
  });

  it("breaks the records down by category without a row or count for the masked ones", () => {
    renderDetails();

    const breakdown = screen.getByRole("region", { name: copy.aggregate.categories.title });
    expect(within(breakdown).getAllByRole("listitem")).toHaveLength(2);
    expect(within(breakdown).getByText(categoryNames.family)).toBeInTheDocument();
    expect(within(breakdown).getByText(categoryCount(8))).toBeInTheDocument();
    expect(within(breakdown).getByText(categoryNames.social)).toBeInTheDocument();
    expect(within(breakdown).getByText(categoryCount(4))).toBeInTheDocument();
    expect(within(breakdown).queryByText(categoryCount(2))).not.toBeInTheDocument();
  });

  it("notes that some details are hidden when some records are masked", () => {
    renderDetails();

    const breakdown = screen.getByRole("region", { name: copy.aggregate.categories.title });
    expect(within(breakdown).getByText(copy.aggregate.masked)).toBeInTheDocument();
  });

  it("leaves the hidden details note out when no record is masked", () => {
    renderDetails({ hasMaskedDetails: false });

    expect(screen.queryByText(copy.aggregate.masked)).not.toBeInTheDocument();
  });

  it("previews the first 5 of 7 pairs behind a collapsed show all", () => {
    renderDetails();

    expect(pairRows()).toHaveLength(5);
    expect(screen.getByRole("button", { name: pairName(5) })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: pairName(6) })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: SHOW_ALL })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("lists all 7 pairs once show all is chosen", async () => {
    renderDetails();

    await userEvent.click(screen.getByRole("button", { name: SHOW_ALL }));

    expect(pairRows()).toHaveLength(7);
    expect(screen.getByRole("button", { name: pairName(7) })).toBeInTheDocument();
  });

  it("opens the clicked pair by its connection id", async () => {
    const onOpenConnection = vi.fn();
    renderDetails({ onOpenConnection });

    await userEvent.click(screen.getByRole("button", { name: pairName(3) }));

    expect(onOpenConnection).toHaveBeenCalledExactlyOnceWith("connection-3");
  });

  it("offers one explore action per group of a link between two groups", () => {
    renderDetails();

    expect(exploreActions()).toEqual([
      screen.getByRole("button", { name: exploreName(SIDES.source) }),
      screen.getByRole("button", { name: exploreName(SIDES.target) }),
    ]);
  });

  it("offers a single explore action for a link between a character and a group", () => {
    renderDetails({ explore: [{ label: SIDES.target, onExplore: vi.fn() }] });

    expect(exploreActions()).toEqual([
      screen.getByRole("button", { name: exploreName(SIDES.target) }),
    ]);
  });

  it("explores only the chosen group and nothing before the choice", async () => {
    const exploreSource = vi.fn();
    const exploreTarget = vi.fn();
    renderDetails({
      explore: [
        { label: SIDES.source, onExplore: exploreSource },
        { label: SIDES.target, onExplore: exploreTarget },
      ],
    });

    expect(exploreTarget).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: exploreName(SIDES.target) }));

    expect(exploreTarget).toHaveBeenCalledOnce();
    expect(exploreSource).not.toHaveBeenCalled();
  });
});
