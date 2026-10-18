import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { RelationshipScope } from "../model/relationship-scope";

import {
  makeCharacterPage,
  makeRosterCharacter,
  RELATIONSHIP_FIXTURE,
} from "../model/relationships.fixtures";
import { RelationshipEditorDialog } from "./relationship-editor-dialog";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const copy = messages.relationships;
const editor = copy.editor;
const discardChanges = messages.common.discardChanges;

const BOOK = RELATIONSHIP_FIXTURE.book;
const GERALT = RELATIONSHIP_FIXTURE.geralt;

const BOOK_SCOPE: Extract<RelationshipScope, { kind: "book" }> = {
  bookId: BOOK.id,
  kind: "book",
};

const ROSTER_PATH = `/api/books/${BOOK.id}/characters`;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

async function changeDraft() {
  await userEvent.click(sourceField());
  await userEvent.click(await screen.findByRole("option", { name: new RegExp(`${GERALT.name}$`) }));
}

async function findDiscardPrompt(): Promise<HTMLElement> {
  return screen.findByRole("alertdialog", { name: editor.discard.title });
}

function renderEditor() {
  const onClose = vi.fn<() => void>();
  renderWithProviders(
    <RelationshipEditorDialog
      bookOptions={[BOOK]}
      onClose={onClose}
      open
      scope={BOOK_SCOPE}
      target={{ mode: "create" }}
    />,
  );
  return { onClose };
}

function sourceField(): HTMLElement {
  return screen.getByRole("combobox", { name: editor.participants.source });
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && pathname === ROSTER_PATH) {
      return Promise.resolve(
        new Response(JSON.stringify(makeCharacterPage([makeRosterCharacter(GERALT)])), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      );
    }
    return Promise.reject(new Error(`unexpected ${method} ${pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("RelationshipEditorDialog unsaved draft guard", () => {
  it("closes an untouched draft straight away", async () => {
    const { onClose } = renderEditor();

    await userEvent.click(screen.getByRole("button", { name: editor.actions.cancel }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("asks before throwing away a changed draft", async () => {
    const { onClose } = renderEditor();

    await changeDraft();
    await userEvent.click(screen.getByRole("button", { name: editor.actions.cancel }));

    expect(await findDiscardPrompt()).toHaveAccessibleDescription(editor.discard.description);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("asks the same way when the author presses Escape", async () => {
    const { onClose } = renderEditor();

    await changeDraft();
    await userEvent.keyboard("{Escape}");

    expect(await findDiscardPrompt()).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("returns to the draft untouched when the author keeps editing", async () => {
    const { onClose } = renderEditor();

    await changeDraft();
    await userEvent.click(screen.getByRole("button", { name: editor.actions.cancel }));
    await userEvent.click(
      within(await findDiscardPrompt()).getByRole("button", { name: discardChanges.cancel }),
    );
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    expect(sourceField()).toHaveTextContent(GERALT.name);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes once the author confirms leaving the draft", async () => {
    const { onClose } = renderEditor();

    await changeDraft();
    await userEvent.click(screen.getByRole("button", { name: editor.actions.cancel }));
    await userEvent.click(
      within(await findDiscardPrompt()).getByRole("button", { name: discardChanges.confirm }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });
});
