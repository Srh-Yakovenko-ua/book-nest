import type { Nullable } from "@app/shared";
import type { RefObject } from "react";

import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { GraphDetailsPanel } from "./graph-details-panel";

const copy = messages.relationships.workspace.panel;

const TITLES = { first: "Aegon II Targaryen", second: "Rhaenyra Targaryen" } as const;

const OUTSIDE_BUTTON = "Outside";

type PanelTreeSetup = {
  focusMemoryRef?: RefObject<Nullable<string>>;
  mounted?: boolean;
  open?: boolean;
  title?: string;
};

function emptyFocusMemory(): RefObject<Nullable<string>> {
  return { current: null };
}

function panelTree({
  focusMemoryRef,
  mounted = true,
  open = true,
  title = TITLES.first,
}: PanelTreeSetup) {
  return (
    <>
      <button type="button">{OUTSIDE_BUTTON}</button>
      {mounted ? (
        <GraphDetailsPanel
          appearance="person"
          autoFocus
          focusMemoryRef={focusMemoryRef}
          onClose={vi.fn()}
          onRestoreFocus={vi.fn()}
          open={open}
          title={title}
          widthClass="wide"
        >
          <p>details</p>
        </GraphDetailsPanel>
      ) : null}
    </>
  );
}

describe("GraphDetailsPanel focus", () => {
  it("focuses the close button when it first opens", () => {
    renderWithProviders(panelTree({ focusMemoryRef: emptyFocusMemory() }));

    expect(screen.getByRole("button", { name: copy.close })).toHaveFocus();
  });

  it("leaves focus where it is when it mounts again for the same character", async () => {
    const focusMemoryRef = emptyFocusMemory();
    const view = renderWithProviders(panelTree({ focusMemoryRef }));
    view.rerender(panelTree({ focusMemoryRef, mounted: false }));
    await userEvent.click(screen.getByRole("button", { name: OUTSIDE_BUTTON }));

    view.rerender(panelTree({ focusMemoryRef }));

    expect(screen.getByRole("complementary", { name: TITLES.first })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: OUTSIDE_BUTTON })).toHaveFocus();
  });

  it("focuses the close button when it mounts again for another character", async () => {
    const focusMemoryRef = emptyFocusMemory();
    const view = renderWithProviders(panelTree({ focusMemoryRef }));
    view.rerender(panelTree({ focusMemoryRef, mounted: false }));
    await userEvent.click(screen.getByRole("button", { name: OUTSIDE_BUTTON }));

    view.rerender(panelTree({ focusMemoryRef, title: TITLES.second }));

    expect(screen.getByRole("button", { name: copy.close })).toHaveFocus();
  });

  it("focuses the close button again after it was closed for the same character", async () => {
    const focusMemoryRef = emptyFocusMemory();
    const view = renderWithProviders(panelTree({ focusMemoryRef }));
    view.rerender(panelTree({ focusMemoryRef, open: false }));
    await userEvent.click(screen.getByRole("button", { name: OUTSIDE_BUTTON }));

    view.rerender(panelTree({ focusMemoryRef }));

    expect(screen.getByRole("button", { name: copy.close })).toHaveFocus();
  });

  it("focuses the close button on every mount without a focus memory", async () => {
    const view = renderWithProviders(panelTree({}));
    view.rerender(panelTree({ mounted: false }));
    await userEvent.click(screen.getByRole("button", { name: OUTSIDE_BUTTON }));

    view.rerender(panelTree({}));

    expect(screen.getByRole("button", { name: copy.close })).toHaveFocus();
  });
});
