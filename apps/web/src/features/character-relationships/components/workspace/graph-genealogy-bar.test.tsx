import type { ComponentProps } from "react";

import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { GraphGenealogyBranch } from "./graph-genealogy-branches";

import { makeRelationshipGraphNode } from "../../model/relationships.fixtures";
import { GraphGenealogyBar } from "./graph-genealogy-bar";

const copy = messages.relationships.workspace.genealogy;

const translateGenealogy = createTranslator({
  locale: "uk",
  messages,
  namespace: "relationships.workspace.genealogy",
});

const ARYA = makeRelationshipGraphNode({
  id: "a1a1a1a1-0000-4000-8000-000000000001",
  name: "Arya Stark",
});

const SANSA = makeRelationshipGraphNode({
  id: "a1a1a1a1-0000-4000-8000-000000000002",
  name: "Sansa Stark",
});

const JON = makeRelationshipGraphNode({
  id: "a1a1a1a1-0000-4000-8000-000000000003",
  name: "Jon Snow",
});

const CERSEI = makeRelationshipGraphNode({
  id: "a1a1a1a1-0000-4000-8000-000000000004",
  name: "Cersei Lannister",
});

const STARK: GraphGenealogyBranch = {
  count: 12,
  id: "house-stark",
  kind: "house",
  label: "House Stark",
  tone: 0,
};

const LANNISTER: GraphGenealogyBranch = {
  count: 7,
  id: "house-lannister",
  kind: "house",
  label: "House Lannister",
  tone: 1,
};

const SNOW: GraphGenealogyBranch = {
  count: 3,
  id: "family-snow",
  kind: "family",
  label: "Snow",
  tone: null,
};

const CLEGANE: GraphGenealogyBranch = {
  count: 2,
  id: "family-clegane",
  kind: "family",
  label: "Clegane",
  tone: null,
};

function branchItem(label: string) {
  return screen.getByRole("menuitem", { name: new RegExp(`^${label}`) });
}

function characterOption(name: string) {
  return screen.getByRole("option", { name: new RegExp(`${name}$`) });
}

async function openBranches(trigger = copy.bar.branches) {
  await userEvent.click(screen.getByRole("button", { name: trigger }));
  await screen.findByRole("menu");
}

async function openSearch() {
  await userEvent.click(screen.getByRole("button", { name: copy.search.trigger }));
  return screen.findByRole("combobox", { name: copy.search.label });
}

function renderBar(overrides: Partial<ComponentProps<typeof GraphGenealogyBar>> = {}) {
  renderWithProviders(
    <GraphGenealogyBar
      activeBranchId={null}
      branches={[STARK, LANNISTER, SNOW]}
      branchesTriggerId="genealogy-branches"
      characters={[CERSEI, SANSA, JON, ARYA]}
      compact={false}
      hiddenIds={new Set()}
      onBranch={vi.fn()}
      onFind={vi.fn()}
      {...overrides}
    />,
  );
}

describe("GraphGenealogyBar", () => {
  it("lists only the characters whose name contains the typed part", async () => {
    renderBar();

    await userEvent.type(await openSearch(), "star");

    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(characterOption(ARYA.name)).toBeInTheDocument();
    expect(characterOption(SANSA.name)).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: new RegExp(`${JON.name}$`) }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(copy.search.empty)).not.toBeInTheDocument();
  });

  it("finds the chosen character and closes the search", async () => {
    const onFind = vi.fn();
    renderBar({ onFind });

    await userEvent.type(await openSearch(), "stark");
    await userEvent.click(characterOption(SANSA.name));

    expect(onFind).toHaveBeenCalledExactlyOnceWith(SANSA.id);
    expect(screen.queryByRole("combobox", { name: copy.search.label })).not.toBeInTheDocument();
  });

  it("says nobody was found when no name matches the query", async () => {
    renderBar();

    await userEvent.type(await openSearch(), "Daenerys");

    expect(await screen.findByText(copy.search.empty)).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("lists every house with its own member count", async () => {
    renderBar();

    await openBranches();

    expect(screen.getByText(copy.bar.houses)).toBeInTheDocument();
    expect(
      within(branchItem(STARK.label)).getByText(translateGenealogy("bar.members", { count: 12 })),
    ).toBeInTheDocument();
    expect(
      within(branchItem(LANNISTER.label)).getByText(
        translateGenealogy("bar.members", { count: 7 }),
      ),
    ).toBeInTheDocument();
  });

  it("highlights the chosen house", async () => {
    const onBranch = vi.fn();
    renderBar({ onBranch });

    await openBranches();
    await userEvent.click(branchItem(LANNISTER.label));

    expect(onBranch).toHaveBeenCalledExactlyOnceWith(LANNISTER.id);
  });

  it("leaves out the separate families group while only one family exists", async () => {
    renderBar({ branches: [STARK, LANNISTER, SNOW] });

    await openBranches();

    expect(screen.queryByText(copy.bar.families)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: new RegExp(`^${SNOW.label}`) }),
    ).not.toBeInTheDocument();
  });

  it("groups the separate families once there are two of them", async () => {
    renderBar({ branches: [STARK, LANNISTER, SNOW, CLEGANE] });

    await openBranches();

    expect(screen.getByText(copy.bar.families)).toBeInTheDocument();
    expect(branchItem(SNOW.label)).toBeInTheDocument();
    expect(branchItem(CLEGANE.label)).toBeInTheDocument();
  });

  it("clears the active branch from the menu named after it", async () => {
    const onBranch = vi.fn();
    renderBar({ activeBranchId: STARK.id, onBranch });

    await openBranches(translateGenealogy("bar.branchActive", { name: STARK.label }));
    await userEvent.click(screen.getByRole("menuitem", { name: copy.bar.clearBranch }));

    expect(onBranch).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("offers no clearing while no branch is active", async () => {
    renderBar();

    await openBranches();

    expect(screen.queryByRole("menuitem", { name: copy.bar.clearBranch })).not.toBeInTheDocument();
  });

  it("names the results list in the reader language", async () => {
    renderBar();

    await userEvent.type(await openSearch(), "star");

    expect(screen.getByRole("listbox", { name: copy.search.listLabel })).toBeInTheDocument();
  });

  it("suggests the language of the record when nobody matches", async () => {
    renderBar();

    await userEvent.type(await openSearch(), "Арія");

    expect(await screen.findByText(copy.search.emptyHint)).toBeInTheDocument();
  });

  it("marks a match hidden in a collapsed branch and still finds it", async () => {
    const onFind = vi.fn();
    renderBar({ hiddenIds: new Set([SANSA.id]), onFind });

    await userEvent.type(await openSearch(), "stark");

    expect(
      within(characterOption(copy.search.collapsed)).getByText(SANSA.name),
    ).toBeInTheDocument();
    expect(
      within(characterOption(ARYA.name)).queryByText(copy.search.collapsed),
    ).not.toBeInTheDocument();
    await userEvent.click(characterOption(copy.search.collapsed));

    expect(onFind).toHaveBeenCalledExactlyOnceWith(SANSA.id);
  });

  it("shrinks to an icon search and a short branches label when compact", async () => {
    renderBar({ compact: true });

    expect(screen.getByRole("button", { name: copy.search.trigger })).not.toHaveTextContent(
      copy.search.trigger,
    );
    await openBranches(copy.bar.branchesShort);

    expect(branchItem(STARK.label)).toBeInTheDocument();
  });
});
