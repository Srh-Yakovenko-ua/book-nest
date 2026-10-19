import "@testing-library/jest-dom/vitest";

import type {
  CharacterRelationshipDetailsView,
  CharacterRelationshipListItemView,
} from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import type { RelationshipScope } from "../model/relationship-scope";

import {
  makeEditableRelationship,
  makeRelationshipListItem,
  makeRelationshipPage,
  RELATIONSHIP_FIXTURE,
} from "../model/relationships.fixtures";
import { RelationshipList } from "./relationship-list";
import { useRelationshipAuthoring } from "./use-relationship-authoring";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const copy = messages.relationships;
const editor = copy.editor;

const BOOK = RELATIONSHIP_FIXTURE.book;
const RELATIONSHIP_ID = RELATIONSHIP_FIXTURE.relationshipId;

const BOOK_SCOPE: Extract<RelationshipScope, { kind: "book" }> = {
  bookId: BOOK.id,
  kind: "book",
};

const PATHS = {
  bookState: `/api/character-relationships/${RELATIONSHIP_ID}/books/${BOOK.id}`,
  editable: `/api/character-relationships/${RELATIONSHIP_ID}/edit`,
  list: "/api/character-relationships",
  relationship: `/api/character-relationships/${RELATIONSHIP_ID}`,
} as const;

const MENU_LABEL = copy.card.actions.menu
  .replace("{source}", RELATIONSHIP_FIXTURE.geralt.name)
  .replace("{target}", RELATIONSHIP_FIXTURE.ciri.name);

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let listItems: CharacterRelationshipListItemView[];
let stored: CharacterRelationshipDetailsView;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

async function openCardAction(action: string) {
  await userEvent.click(await screen.findByRole("button", { name: MENU_LABEL }));
  await userEvent.click(await screen.findByRole("menuitem", { name: action }));
}

function RelationshipsPanel() {
  const authoring = useRelationshipAuthoring({ bookOptions: [BOOK], scope: BOOK_SCOPE });

  return (
    <NuqsTestingAdapter hasMemory>
      <RelationshipList
        onDelete={authoring.actions.onDelete}
        onEdit={authoring.actions.onEdit}
        scope={BOOK_SCOPE}
      />
      {authoring.dialogs}
    </NuqsTestingAdapter>
  );
}

function requestsTo(path: string): number {
  return fetchMock.mock.calls.filter(
    ([input, init]) =>
      (init?.method ?? "GET").toUpperCase() === "GET" &&
      new URL(String(input), "http://localhost").pathname === path,
  ).length;
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  listItems = [makeRelationshipListItem()];
  stored = makeEditableRelationship();

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && pathname === PATHS.list) {
      return Promise.resolve(jsonResponse(makeRelationshipPage(listItems)));
    }
    if (method === "GET" && pathname === PATHS.editable) {
      return Promise.resolve(jsonResponse(stored));
    }
    if (method === "DELETE" && pathname === PATHS.relationship) {
      listItems = [];
      return Promise.resolve(jsonResponse({ bookStateCount: 1, id: RELATIONSHIP_ID }));
    }
    if (method === "DELETE" && pathname === PATHS.bookState) {
      stored = { ...stored, bookStates: [] };
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.reject(new Error(`unexpected ${method} ${pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useRelationshipAuthoring with the relationship list", () => {
  it("reads the authoring view only once the editor opens from a card", async () => {
    renderWithProviders(<RelationshipsPanel />);

    expect(await screen.findByRole("button", { name: MENU_LABEL })).toBeInTheDocument();
    expect(requestsTo(PATHS.editable)).toBe(0);
    await openCardAction(copy.card.actions.edit);

    expect(await screen.findByRole("dialog", { name: editor.editTitle })).toBeInTheDocument();
    await waitFor(() => expect(requestsTo(PATHS.editable)).toBe(1));
  });

  it("drops a deleted relationship from the list", async () => {
    renderWithProviders(<RelationshipsPanel />);

    await openCardAction(copy.card.actions.delete);
    const dialog = await screen.findByRole("alertdialog", { name: copy.deleteDialog.title });
    await userEvent.click(within(dialog).getByRole("button", { name: copy.deleteDialog.confirm }));

    expect(
      await screen.findByRole("heading", { name: copy.list.empty.book.title }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: MENU_LABEL })).not.toBeInTheDocument();
  });

  it("refreshes the list after one book's details are removed in the editor", async () => {
    renderWithProviders(<RelationshipsPanel />);

    await openCardAction(copy.card.actions.edit);
    await userEvent.click(await screen.findByRole("button", { name: editor.book.remove }));
    const confirmation = await screen.findByRole("alertdialog", {
      name: copy.removeBookStateDialog.title,
    });
    expect(requestsTo(PATHS.list)).toBe(1);
    await userEvent.click(
      within(confirmation).getByRole("button", { name: copy.removeBookStateDialog.confirm }),
    );

    await waitFor(() => expect(requestsTo(PATHS.list)).toBe(2));
    expect(await screen.findByText(editor.book.noState)).toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: editor.editTitle })).toBeInTheDocument();
  });
});
