import type { Nullable } from "@app/shared";
import type { ReactNode, RefObject } from "react";

import { act } from "react";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { GraphDetailsPanel } from "./graph-details-panel";

const copy = messages.relationships.workspace.panel;

const TITLES = { first: "Aegon II Targaryen", second: "Rhaenyra Targaryen" } as const;

const OUTSIDE_BUTTON = "Outside";

const SEARCH_FIELD = "Find a relative";

type CompactPanelSetup = {
  children?: ReactNode;
  title?: string;
};

type PanelTreeSetup = {
  focusMemoryRef?: RefObject<Nullable<string>>;
  mounted?: boolean;
  open?: boolean;
  title?: string;
};

function compactPanel(
  onClose: () => void,
  { children = <input aria-label={SEARCH_FIELD} />, title = TITLES.first }: CompactPanelSetup = {},
) {
  return (
    <GraphDetailsPanel
      appearance="person"
      autoFocus
      onClose={onClose}
      onRestoreFocus={vi.fn()}
      open
      title={title}
      widthClass="compact"
    >
      {children}
    </GraphDetailsPanel>
  );
}

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

describe("GraphDetailsPanel at compact width", () => {
  it("stays open on Escape while a field inside it holds text", async () => {
    const onClose = vi.fn();
    renderWithProviders(compactPanel(onClose));

    await userEvent.type(screen.getByRole("textbox", { name: SEARCH_FIELD }), "Aegon");
    await userEvent.keyboard("{Escape}");

    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape from an empty field inside it", async () => {
    const onClose = vi.fn();
    renderWithProviders(compactPanel(onClose));

    await userEvent.click(screen.getByRole("textbox", { name: SEARCH_FIELD }));
    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("moves the focus to its close button when another character's content drops the focused field", async () => {
    const view = renderWithProviders(compactPanel(vi.fn()));
    await userEvent.click(screen.getByRole("textbox", { name: SEARCH_FIELD }));
    expect(screen.getByRole("textbox", { name: SEARCH_FIELD })).toHaveFocus();

    view.rerender(compactPanel(vi.fn(), { children: <p>details</p>, title: TITLES.second }));

    await waitFor(() => expect(screen.getByRole("button", { name: copy.close })).toHaveFocus());
  });

  it("moves the focus from the sheet itself to its close button for another character", () => {
    const view = renderWithProviders(compactPanel(vi.fn()));
    const sheet = screen.getByRole("dialog", { name: TITLES.first });
    act(() => sheet.focus());
    expect(sheet).toHaveFocus();

    view.rerender(compactPanel(vi.fn(), { title: TITLES.second }));

    expect(screen.getByRole("button", { name: copy.close })).toHaveFocus();
  });

  it("keeps the focus on a field that stays in another character's content", async () => {
    const view = renderWithProviders(compactPanel(vi.fn()));
    const field = screen.getByRole("textbox", { name: SEARCH_FIELD });
    await userEvent.click(field);

    view.rerender(compactPanel(vi.fn(), { title: TITLES.second }));
    await act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

    expect(field).toHaveFocus();
  });
});
