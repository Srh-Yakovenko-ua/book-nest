import type { CharacterGraphClusterView } from "@app/shared";
import type { ComponentProps } from "react";

import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { NetworkBucket } from "../../model/workspace/graph-network-index";

import {
  makeRelationshipGraph,
  makeRelationshipGraphNode,
} from "../../model/relationships.fixtures";
import { buildNetworkIndex } from "../../model/workspace/graph-network-index";
import { GraphNetworkSearch } from "./graph-network-search";

const copy = messages.relationships.workspace.networkSearch;

const translate = createTranslator({
  locale: "uk",
  messages,
  namespace: "relationships.workspace.networkSearch",
});

const GROUPS = {
  marauders: { id: "0a0a0a0a-0000-4000-8000-000000000001", name: "Marauders" },
  market: { id: "0a0a0a0a-0000-4000-8000-000000000002", name: "Old Market" },
} as const;

const CLUSTERS: CharacterGraphClusterView[] = [
  {
    groupType: "family",
    id: GROUPS.marauders.id,
    kind: "group",
    name: GROUPS.marauders.name,
    size: 2,
  },
  {
    groupType: "family",
    id: GROUPS.market.id,
    kind: "group",
    name: GROUPS.market.name,
    size: 1,
  },
];

const CHARACTERS = {
  jonInMarauders: makeRelationshipGraphNode({
    clusterId: GROUPS.marauders.id,
    id: "0b0b0b0b-0000-4000-8000-000000000011",
    name: "Jon Snow",
  }),
  jonInMarket: makeRelationshipGraphNode({
    clusterId: GROUPS.market.id,
    id: "0b0b0b0b-0000-4000-8000-000000000012",
    name: "Jon Snow",
  }),
  marcus: makeRelationshipGraphNode({
    clusterId: GROUPS.marauders.id,
    id: "0b0b0b0b-0000-4000-8000-000000000013",
    name: "Marcus",
  }),
  marek: makeRelationshipGraphNode({
    clusterId: null,
    id: "0b0b0b0b-0000-4000-8000-000000000014",
    name: "Marek",
  }),
};

const TRIGGER_ID = "graph-network-search-trigger";

const INDEX = buildNetworkIndex({
  graph: makeRelationshipGraph({
    clusterBy: "group",
    clusters: CLUSTERS,
    edges: [],
    nodes: [CHARACTERS.jonInMarauders, CHARACTERS.jonInMarket, CHARACTERS.marcus],
  }),
  grouping: "group",
});

function labelOf(bucket: NetworkBucket): string {
  return bucket.label.kind === "group" ? (bucket.label.name ?? "") : bucket.key;
}

async function openSearch(): Promise<HTMLElement> {
  await userEvent.click(screen.getByRole("button", { name: copy.trigger }));
  return screen.findByRole("combobox", { name: copy.label });
}

function renderSearch(overrides: Partial<ComponentProps<typeof GraphNetworkSearch>> = {}) {
  renderWithProviders(
    <GraphNetworkSearch
      blockedNodes={[]}
      compact={false}
      index={INDEX}
      labelOf={labelOf}
      onOpenChange={vi.fn()}
      onPickBlocked={vi.fn()}
      onPickCharacter={vi.fn()}
      onPickGroup={vi.fn()}
      triggerId={TRIGGER_ID}
      {...overrides}
    />,
  );
}

describe("GraphNetworkSearch", () => {
  it("labels each result with its kind and a character with its group", async () => {
    renderSearch();

    await userEvent.type(await openSearch(), "mar");

    const groups = screen.getByRole("group", { name: copy.groups });
    const characters = screen.getByRole("group", { name: copy.characters });
    expect(within(groups).getByText(GROUPS.marauders.name)).toBeInTheDocument();
    expect(within(groups).getByText(translate("groupMeta", { count: 2 }))).toBeInTheDocument();
    expect(within(characters).getByText(CHARACTERS.marcus.displayName)).toBeInTheDocument();
    expect(
      within(characters).getByText(
        translate("characterInGroupMeta", { group: GROUPS.marauders.name }),
      ),
    ).toBeInTheDocument();
  });

  it("picks the highlighted group with Enter by its bucket id", async () => {
    const onPickCharacter = vi.fn();
    const onPickGroup = vi.fn();
    renderSearch({ onPickCharacter, onPickGroup });

    await userEvent.type(await openSearch(), "old market");
    await userEvent.keyboard("{Enter}");

    expect(onPickGroup).toHaveBeenCalledExactlyOnceWith(`cluster:group:${GROUPS.market.id}`);
    expect(onPickCharacter).not.toHaveBeenCalled();
  });

  it("keeps namesakes apart and picks the highlighted one by its id", async () => {
    const onPickCharacter = vi.fn();
    renderSearch({ onPickCharacter });

    await userEvent.type(await openSearch(), "jon snow");
    await userEvent.keyboard("{ArrowDown}");

    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(
      within(screen.getByRole("option", { selected: true })).getByText(
        translate("characterInGroupMeta", { group: GROUPS.market.name }),
      ),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Enter}");

    expect(onPickCharacter).toHaveBeenCalledExactlyOnceWith(CHARACTERS.jonInMarket.id);
  });

  it("lists a character hidden by the filters apart and hands it back on pick", async () => {
    const onPickBlocked = vi.fn();
    const onPickCharacter = vi.fn();
    renderSearch({ blockedNodes: [CHARACTERS.marek], onPickBlocked, onPickCharacter });

    await userEvent.type(await openSearch(), "marek");
    const blocked = screen.getByRole("group", { name: copy.blocked });
    expect(within(blocked).getByText(copy.blockedMeta)).toBeInTheDocument();
    await userEvent.click(within(blocked).getByText(CHARACTERS.marek.displayName));

    expect(onPickBlocked).toHaveBeenCalledExactlyOnceWith(CHARACTERS.marek);
    expect(onPickCharacter).not.toHaveBeenCalled();
  });

  it("says nothing was found and drops the earlier result once no name matches", async () => {
    renderSearch();
    const input = await openSearch();
    await userEvent.type(input, "marcus");

    await userEvent.type(input, "z");

    expect(await screen.findByText(copy.empty)).toBeInTheDocument();
    expect(screen.getByText(copy.emptyHint)).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("closes on Escape and gives the focus back to its trigger", async () => {
    const onOpenChange = vi.fn();
    renderSearch({ onOpenChange });
    await openSearch();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("combobox", { name: copy.label })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: copy.trigger })).toHaveFocus());
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it.each([{ compact: false }, { compact: true }])(
    "puts the given id on its trigger when compact is $compact",
    ({ compact }) => {
      renderSearch({ compact });

      expect(screen.getByRole("button", { name: copy.trigger })).toHaveAttribute("id", TRIGGER_ID);
    },
  );
});
