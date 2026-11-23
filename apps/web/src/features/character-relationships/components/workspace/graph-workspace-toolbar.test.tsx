import type { ComponentProps } from "react";

import { createTranslator } from "next-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import type { GraphWorkspaceState } from "../../model/workspace/use-graph-workspace-state";
import type { GraphToolbarGenealogy } from "./graph-workspace-toolbar";

import { TREE_SCENE } from "../../model/workspace/graph-tree-scene";
import { loadGraphWorkspaceParams } from "../../model/workspace/graph-workspace-params";
import { GraphTreeScopeSwitch, GraphWorkspaceToolbar } from "./graph-workspace-toolbar";

const copy = messages.relationships.workspace;

const translate = createTranslator({
  locale: "uk",
  messages,
  namespace: "relationships.workspace",
});

const BOOK_ID = "b0b0b0b0-0000-4000-8000-000000000000";

const CHARACTER_ID = "f0f0f0f0-0000-4000-8000-000000000000";

const GENEALOGY_SEARCH = { treeScope: "full", view: "tree" };

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

function makeGenealogy(overrides: Partial<GraphToolbarGenealogy> = {}): GraphToolbarGenealogy {
  return {
    activeBranchId: null,
    branches: [],
    branchesTriggerId: "genealogy-branches",
    characters: [],
    collapsedBranches: 0,
    hiddenCount: 0,
    hiddenIds: new Set(),
    onBranch: vi.fn(),
    onExpandAll: vi.fn(),
    onFind: vi.fn(),
    ...overrides,
  };
}

function renderToolbar({
  actions = makeActions(),
  search,
  ...overrides
}: Partial<ComponentProps<typeof GraphWorkspaceToolbar>> & {
  search: Record<string, string>;
}) {
  renderWithProviders(
    <GraphWorkspaceToolbar
      actions={actions}
      bookId={BOOK_ID}
      filtersTriggerId="graph-workspace-filters"
      genealogy={null}
      onTreeOptionsChange={vi.fn()}
      onTreeOptionsReset={vi.fn()}
      params={loadGraphWorkspaceParams(new URLSearchParams(search))}
      rootParticipant={null}
      treeOptions={TREE_SCENE.defaultOptions}
      widthClass="wide"
      {...overrides}
    />,
  );
}

function stubScreenHeight(isShort: boolean) {
  vi.stubGlobal("matchMedia", (media: string) => ({
    addEventListener: vi.fn(),
    matches: media.includes("max-height") ? isShort : false,
    media,
    removeEventListener: vi.fn(),
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GraphTreeScopeSwitch", () => {
  it("offers the family tree scope set to the character branch", () => {
    renderWithProviders(
      <GraphTreeScopeSwitch
        actions={makeActions()}
        params={loadGraphWorkspaceParams(
          new URLSearchParams({ characterId: CHARACTER_ID, view: "tree" }),
        )}
      />,
    );

    const scope = screen.getByRole("radiogroup", { name: copy.treeScope.label });
    expect(within(scope).getByRole("radio", { name: copy.treeScope.branch })).toBeChecked();
    expect(within(scope).getByRole("radio", { name: copy.treeScope.full })).not.toBeChecked();
  });

  it("switches to the whole genealogy keeping the central character", async () => {
    const setTreeScope = vi.fn();
    renderWithProviders(
      <GraphTreeScopeSwitch
        actions={{ ...makeActions(), setTreeScope }}
        params={loadGraphWorkspaceParams(
          new URLSearchParams({ characterId: CHARACTER_ID, view: "tree" }),
        )}
      />,
    );

    await userEvent.click(screen.getByRole("radio", { name: copy.treeScope.full }));

    expect(setTreeScope).toHaveBeenCalledExactlyOnceWith({
      characterId: CHARACTER_ID,
      treeScope: "full",
    });
  });
});

describe("GraphWorkspaceToolbar", () => {
  it("hides the central character picker and the generations in the whole genealogy", () => {
    stubScreenHeight(false);
    renderToolbar({ search: { characterId: CHARACTER_ID, ...GENEALOGY_SEARCH } });

    expect(screen.queryByRole("combobox", { name: copy.picker.label })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: copy.generations.label })).not.toBeInTheDocument();
  });

  it("shows the central character picker and the generations for a character branch", () => {
    stubScreenHeight(false);
    renderToolbar({ search: { characterId: CHARACTER_ID, treeScope: "branch", view: "tree" } });

    expect(screen.getByRole("combobox", { name: copy.picker.label })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: copy.generations.label })).toBeInTheDocument();
  });

  it("keeps expand all focusable but inert when no branch is collapsed", async () => {
    stubScreenHeight(false);
    const genealogy = makeGenealogy();
    renderToolbar({ genealogy, search: GENEALOGY_SEARCH });

    const expandAll = screen.getByRole("button", { name: copy.genealogy.bar.expandAll });
    expect(expandAll).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(expandAll);

    expect(genealogy.onExpandAll).not.toHaveBeenCalled();
  });

  it("counts collapsed branches next to expand all and names the hidden characters", async () => {
    stubScreenHeight(false);
    const genealogy = makeGenealogy({ collapsedBranches: 2, hiddenCount: 14 });
    renderToolbar({ genealogy, search: GENEALOGY_SEARCH });

    const expandAll = screen.getByRole("button", {
      name: translate("genealogy.bar.expandAllLabel", { branches: 2, hidden: 14 }),
    });
    expect(expandAll).toHaveTextContent(translate("genealogy.bar.expandAllCount", { count: 2 }));
    await userEvent.click(expandAll);

    expect(genealogy.onExpandAll).toHaveBeenCalledOnce();
  });

  it("groups expand all and the path search into one menu on a short screen", async () => {
    stubScreenHeight(true);
    const actions = makeActions();
    const genealogy = makeGenealogy({ collapsedBranches: 1, hiddenCount: 3 });
    renderToolbar({ actions, genealogy, search: GENEALOGY_SEARCH });

    expect(
      screen.queryByRole("button", {
        name: translate("genealogy.bar.expandAllLabel", { branches: 1, hidden: 3 }),
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.pathEntryShort })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: copy.toolbar.more }));
    const menu = await screen.findByRole("menu");
    const [expandAll] = within(menu).getAllByRole("menuitem");
    expect(expandAll).toHaveTextContent(translate("genealogy.bar.expandAllCount", { count: 1 }));
    expect(expandAll).toHaveTextContent(translate("genealogy.bar.hiddenCharacters", { count: 3 }));
    await userEvent.click(within(menu).getByRole("menuitem", { name: copy.pathEntry }));

    expect(actions.openPath).toHaveBeenCalledExactlyOnceWith(null);
  });

  it("marks the link filter changed from the defaults and warns about hidden characters", async () => {
    stubScreenHeight(false);
    const onTreeOptionsReset = vi.fn();
    renderToolbar({
      onTreeOptionsReset,
      search: GENEALOGY_SEARCH,
      treeOptions: { ...TREE_SCENE.defaultOptions, marriages: false },
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: translate("treeOptions.triggerLabelChanged", { changed: 1, enabled: 3, total: 5 }),
      }),
    );
    const options = await screen.findByRole("dialog", { name: copy.treeOptions.trigger });

    expect(within(options).getByText(copy.treeOptions.changedOff)).toBeInTheDocument();
    expect(within(options).getByText(copy.treeOptions.hidesCharacters)).toBeInTheDocument();
    await userEvent.click(within(options).getByRole("button", { name: copy.treeOptions.reset }));

    expect(onTreeOptionsReset).toHaveBeenCalledOnce();
  });

  it("keeps the defaults reset inert while nothing differs from the defaults", async () => {
    stubScreenHeight(false);
    const onTreeOptionsReset = vi.fn();
    renderToolbar({ onTreeOptionsReset, search: GENEALOGY_SEARCH });

    await userEvent.click(
      screen.getByRole("button", {
        name: translate("treeOptions.triggerLabel", { enabled: 4, total: 5 }),
      }),
    );
    const options = await screen.findByRole("dialog", { name: copy.treeOptions.trigger });
    const reset = within(options).getByRole("button", { name: copy.treeOptions.reset });
    expect(reset).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(reset);

    expect(onTreeOptionsReset).not.toHaveBeenCalled();
    expect(within(options).queryByText(copy.treeOptions.changedOff)).not.toBeInTheDocument();
  });
});
