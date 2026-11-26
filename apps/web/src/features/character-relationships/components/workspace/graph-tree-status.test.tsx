import type { ComponentProps } from "react";

import { BOOK_FAMILY_TREE } from "@app/shared";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { GraphTreeStatus } from "./graph-tree-status";

const copy = messages.relationships.workspace;

const translate = createTranslator({
  locale: "uk",
  messages,
  namespace: "relationships.workspace",
});

const HIDDEN_CHARACTER = {
  id: "c3c3c3c3-0000-4000-8000-000000000003",
  name: "Garmund Hightower",
} as const;

const EXPECTED_TEXT = {
  collapsed: translate("notices.genealogyCollapsed", {
    branches: 2,
    hidden: 14,
    limit: BOOK_FAMILY_TREE.nodeLimit,
  }),
  filtered: translate("tree.hiddenSelection.filtered", { name: HIDDEN_CHARACTER.name }),
  multiLine: translate("notices.genealogyMultiLine"),
  truncated: translate("notices.genealogyTruncated", { limit: BOOK_FAMILY_TREE.nodeLimit }),
} as const;

function statusProps(
  overrides: Partial<ComponentProps<typeof GraphTreeStatus>> = {},
): ComponentProps<typeof GraphTreeStatus> {
  return {
    collapsed: null,
    hiddenSelection: null,
    immersive: false,
    notices: [],
    onConfirmOverwrite: vi.fn(),
    onDismissHiddenSelection: vi.fn(),
    onDismissOverwrite: vi.fn(),
    onResetLinks: vi.fn(),
    onRevealSelection: vi.fn(),
    pendingOverwrite: false,
    ...overrides,
  };
}

describe("GraphTreeStatus notices", () => {
  it("shows a warning and an info notice inside the status region", () => {
    renderWithProviders(
      <GraphTreeStatus
        {...statusProps({ notices: ["genealogyTruncated", "genealogyMultiLine"] })}
      />,
    );

    const status = screen.getByRole("status");
    expect(within(status).getByText(EXPECTED_TEXT.truncated)).toBeInTheDocument();
    expect(within(status).getByText(EXPECTED_TEXT.multiLine)).toBeInTheDocument();
  });

  it("drops the info notice in full screen but keeps the warning", () => {
    renderWithProviders(
      <GraphTreeStatus
        {...statusProps({ immersive: true, notices: ["genealogyTruncated", "genealogyMultiLine"] })}
      />,
    );

    const status = screen.getByRole("status");
    expect(within(status).getByText(EXPECTED_TEXT.truncated)).toBeInTheDocument();
    expect(within(status).queryByText(EXPECTED_TEXT.multiLine)).not.toBeInTheDocument();
  });

  it("counts the collapsed branches and the characters they hide", () => {
    renderWithProviders(
      <GraphTreeStatus
        {...statusProps({
          collapsed: { branches: 2, hidden: 14 },
          notices: ["genealogyCollapsed"],
        })}
      />,
    );

    expect(
      within(screen.getByRole("status")).getByText(EXPECTED_TEXT.collapsed),
    ).toBeInTheDocument();
  });
});

describe("GraphTreeStatus hidden selection", () => {
  it("names the character hidden by the link filters", () => {
    renderWithProviders(
      <GraphTreeStatus
        {...statusProps({ hiddenSelection: { ...HIDDEN_CHARACTER, reason: "filtered" } })}
      />,
    );

    expect(
      within(screen.getByRole("status")).getByText(EXPECTED_TEXT.filtered),
    ).toBeInTheDocument();
  });

  it("resets the links instead of revealing a character hidden by the filters", async () => {
    const onResetLinks = vi.fn();
    const onRevealSelection = vi.fn<(characterId: string) => void>();
    renderWithProviders(
      <GraphTreeStatus
        {...statusProps({
          hiddenSelection: { ...HIDDEN_CHARACTER, reason: "filtered" },
          onResetLinks,
          onRevealSelection,
        })}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: copy.tree.hiddenSelection.action.filtered }),
    );

    expect(onResetLinks).toHaveBeenCalledTimes(1);
    expect(onRevealSelection).not.toHaveBeenCalled();
  });

  it("reveals a character hidden in a collapsed branch by its id", async () => {
    const onResetLinks = vi.fn();
    const onRevealSelection = vi.fn<(characterId: string) => void>();
    renderWithProviders(
      <GraphTreeStatus
        {...statusProps({
          hiddenSelection: { ...HIDDEN_CHARACTER, reason: "collapsed" },
          onResetLinks,
          onRevealSelection,
        })}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: copy.tree.hiddenSelection.action.collapsed }),
    );

    expect(onRevealSelection).toHaveBeenCalledExactlyOnceWith(HIDDEN_CHARACTER.id);
    expect(onResetLinks).not.toHaveBeenCalled();
  });

  it("dismisses the hidden selection message", async () => {
    const onDismissHiddenSelection = vi.fn();
    renderWithProviders(
      <GraphTreeStatus
        {...statusProps({
          hiddenSelection: { ...HIDDEN_CHARACTER, reason: "filtered" },
          onDismissHiddenSelection,
        })}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: copy.tree.hiddenSelection.dismiss }));

    expect(onDismissHiddenSelection).toHaveBeenCalledTimes(1);
  });
});
