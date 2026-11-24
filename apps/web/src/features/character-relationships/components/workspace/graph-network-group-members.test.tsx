import type { ComponentProps } from "react";

import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { GraphNetworkGroupMember } from "./graph-network-group-members";

import { makeRelationshipGraphNode } from "../../model/relationships.fixtures";
import { GraphNetworkGroupMembers } from "./graph-network-group-members";

const copy = messages.relationships.workspace.networkPanel;

const translate = createTranslator({
  locale: "uk",
  messages,
  namespace: "relationships.workspace.networkPanel",
});

const GROUP = "House Stark";

const STARKS = {
  arya: makeRelationshipGraphNode({
    id: "0e0e0e0e-0000-4000-8000-000000000001",
    name: "Arya Stark",
  }),
  jon: makeRelationshipGraphNode({
    id: "0e0e0e0e-0000-4000-8000-000000000002",
    name: "Jon Snow",
  }),
  sansa: makeRelationshipGraphNode({
    id: "0e0e0e0e-0000-4000-8000-000000000003",
    name: "Sansa Stark",
  }),
};

const FAMILY: GraphNetworkGroupMember[] = [
  { isOnMap: true, node: STARKS.arya, pairCount: 3 },
  { isOnMap: false, node: STARKS.jon, pairCount: 1 },
  { isOnMap: true, node: STARKS.sansa, pairCount: 2 },
];

const GARRISON = Array.from({ length: 45 }, (_, index): GraphNetworkGroupMember => {
  const number = String(index + 1).padStart(2, "0");
  return {
    isOnMap: false,
    node: makeRelationshipGraphNode({
      id: `0f0f0f0f-0000-4000-8000-0000000000${number}`,
      name: `Soldier ${number}`,
    }),
    pairCount: 1,
  };
});

function memberOption(name: string): HTMLElement {
  return screen.getByRole("option", { name: (accessibleName) => accessibleName.includes(name) });
}

function renderMembers(overrides: Partial<ComponentProps<typeof GraphNetworkGroupMembers>> = {}) {
  renderWithProviders(
    <GraphNetworkGroupMembers
      groupLabel={GROUP}
      members={FAMILY}
      onSelect={vi.fn()}
      {...overrides}
    />,
  );
}

describe("GraphNetworkGroupMembers", () => {
  it("lists the first 40 of 45 members and counts every one of them", () => {
    renderMembers({ members: GARRISON });

    expect(screen.getByText(translate("members.count", { count: 45 }))).toBeInTheDocument();
    expect(screen.getByText("Soldier 40")).toBeInTheDocument();
    expect(screen.queryByText("Soldier 41")).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: translate("list.showMore", { count: 5 }) }),
    ).toBeInTheDocument();
  });

  it("lists the remaining members once show more is chosen", async () => {
    renderMembers({ members: GARRISON });

    await userEvent.click(
      screen.getByRole("option", { name: translate("list.showMore", { count: 5 }) }),
    );

    expect(screen.getByText("Soldier 45")).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: translate("list.showMore", { count: 5 }) }),
    ).not.toBeInTheDocument();
  });

  it("filters the members by name", async () => {
    renderMembers();

    await userEvent.type(
      screen.getByRole("combobox", { name: translate("members.label", { name: GROUP }) }),
      "stark",
    );

    expect(screen.getByText(STARKS.arya.displayName)).toBeInTheDocument();
    expect(screen.getByText(STARKS.sansa.displayName)).toBeInTheDocument();
    expect(screen.queryByText(STARKS.jon.displayName)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(translate("members.found", { count: 2 }));
  });

  it("says nobody was found when no member name matches", async () => {
    renderMembers();

    await userEvent.type(
      screen.getByRole("combobox", { name: translate("members.label", { name: GROUP }) }),
      "targaryen",
    );

    expect(await screen.findByText(copy.members.empty)).toBeInTheDocument();
    expect(screen.queryByRole("option")).not.toBeInTheDocument();
  });

  it("marks the members that are on the map", () => {
    renderMembers();

    expect(
      within(memberOption(STARKS.arya.displayName)).getByText(copy.members.onMap),
    ).toBeInTheDocument();
    expect(
      within(memberOption(STARKS.jon.displayName)).queryByText(copy.members.onMap),
    ).not.toBeInTheDocument();
  });

  it("selects the clicked member by its id", async () => {
    const onSelect = vi.fn();
    renderMembers({ onSelect });

    await userEvent.click(screen.getByText(STARKS.jon.displayName));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(STARKS.jon.id);
  });

  it("selects the member highlighted with the arrow keys on Enter", async () => {
    const onSelect = vi.fn();
    renderMembers({ onSelect });

    await userEvent.click(
      screen.getByRole("combobox", { name: translate("members.label", { name: GROUP }) }),
    );
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(STARKS.jon.id);
  });
});
