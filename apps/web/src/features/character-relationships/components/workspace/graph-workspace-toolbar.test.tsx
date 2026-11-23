import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";

import { TREE_SCENE } from "../../model/workspace/graph-tree-scene";
import { loadGraphWorkspaceParams } from "../../model/workspace/graph-workspace-params";
import { GraphWorkspaceToolbar } from "./graph-workspace-toolbar";

const copy = messages.relationships.workspace;

const BOOK_ID = "b0b0b0b0-0000-4000-8000-000000000000";

const CHARACTER_ID = "f0f0f0f0-0000-4000-8000-000000000000";

function makeActions(): GraphWorkspaceState["actions"] {
  return {
    chooseCharacter: vi.fn(),
    clearCharacter: vi.fn(),
    closePath: vi.fn(),
    exploreFromPath: vi.fn(),
    makeCenter: vi.fn(),
    openPath: vi.fn(),
    resetFilters: vi.fn(),
    resetTreeLinks: vi.fn(),
    setDepth: vi.fn(),
    setFilters: vi.fn(),
    setGenerations: vi.fn(),
    setNetworkGroup: vi.fn(),
    setPathEndpoints: vi.fn(),
    setTreeOptions: vi.fn(),
    setTreeScope: vi.fn(),
    setView: vi.fn(),
  };
}

function renderToolbar({
  actions = makeActions(),
  search,
}: {
  actions?: GraphWorkspaceState["actions"];
  search: Record<string, string>;
}) {
  renderWithProviders(
    <GraphWorkspaceToolbar
      actions={actions}
      bookId={BOOK_ID}
      filtersTriggerId="graph-workspace-filters"
      onTreeOptionsChange={vi.fn()}
      onTreeOptionsReset={vi.fn()}
      params={loadGraphWorkspaceParams(new URLSearchParams(search))}
      rootParticipant={null}
      treeOptions={TREE_SCENE.defaultOptions}
    />,
  );
}

describe("GraphWorkspaceToolbar", () => {
  it("offers the family tree scope in the tree view, set to the character branch", () => {
    renderToolbar({ search: { characterId: CHARACTER_ID, view: "tree" } });

    const scope = screen.getByRole("radiogroup", { name: copy.treeScope.label });
    expect(within(scope).getByRole("radio", { name: copy.treeScope.branch })).toBeChecked();
    expect(within(scope).getByRole("radio", { name: copy.treeScope.full })).not.toBeChecked();
  });

  it.each(["person", "network"])("offers no family tree scope in the %s view", (view) => {
    renderToolbar({ search: { characterId: CHARACTER_ID, view } });

    expect(
      screen.queryByRole("radiogroup", { name: copy.treeScope.label }),
    ).not.toBeInTheDocument();
  });

  it("switches to the whole genealogy keeping the central character", async () => {
    const setTreeScope = vi.fn();
    renderToolbar({
      actions: { ...makeActions(), setTreeScope },
      search: { characterId: CHARACTER_ID, view: "tree" },
    });

    await userEvent.click(screen.getByRole("radio", { name: copy.treeScope.full }));

    expect(setTreeScope).toHaveBeenCalledExactlyOnceWith({
      characterId: CHARACTER_ID,
      treeScope: "full",
    });
  });

  it("hides the central character picker and the generations in the whole genealogy", () => {
    renderToolbar({ search: { characterId: CHARACTER_ID, treeScope: "full", view: "tree" } });

    expect(screen.getByRole("radio", { name: copy.treeScope.full })).toBeChecked();
    expect(screen.queryByRole("combobox", { name: copy.picker.label })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: copy.generations.label })).not.toBeInTheDocument();
  });

  it("shows the central character picker and the generations for a character branch", () => {
    renderToolbar({ search: { characterId: CHARACTER_ID, treeScope: "branch", view: "tree" } });

    expect(screen.getByRole("combobox", { name: copy.picker.label })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: copy.generations.label })).toBeInTheDocument();
  });
});
