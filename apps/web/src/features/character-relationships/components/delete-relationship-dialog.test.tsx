import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import {
  makeEditableBookState,
  makeEditableRelationship,
  RELATIONSHIP_FIXTURE,
} from "../model/relationships.fixtures";
import { DeleteRelationshipDialog } from "./delete-relationship-dialog";

type SentRequest = { method: string; path: string };

const copy = messages.relationships;
const deleteDialog = copy.deleteDialog;

const RELATIONSHIP_ID = RELATIONSHIP_FIXTURE.relationshipId;

const PATHS = {
  editable: `/api/character-relationships/${RELATIONSHIP_ID}/edit`,
  relationship: `/api/character-relationships/${RELATIONSHIP_ID}`,
} as const;

const RELATIONSHIP = makeEditableRelationship({
  bookStates: [
    makeEditableBookState({ bookId: RELATIONSHIP_FIXTURE.book.id, id: "state-1" }),
    makeEditableBookState({ bookId: RELATIONSHIP_FIXTURE.secondBook.id, id: "state-2" }),
  ],
});

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderDialog() {
  const onClose = vi.fn<() => void>();
  const onDeleted = vi.fn<() => void>();
  renderWithProviders(
    <DeleteRelationshipDialog
      onClose={onClose}
      onDeleted={onDeleted}
      open
      relationshipId={RELATIONSHIP_ID}
    />,
  );
  return { onClose, onDeleted };
}

function writeRequests(): SentRequest[] {
  return fetchMock.mock.calls.flatMap(([input, init]) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET") return [];
    return [{ method, path: new URL(String(input), "http://localhost").pathname }];
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && pathname === PATHS.editable) {
      return Promise.resolve(jsonResponse(RELATIONSHIP));
    }
    if (method === "DELETE" && pathname === PATHS.relationship) {
      return Promise.resolve(jsonResponse({ bookStateCount: 2, id: RELATIONSHIP_ID }));
    }
    return Promise.reject(new Error(`unexpected ${method} ${pathname}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DeleteRelationshipDialog", () => {
  it("warns that the relationship goes from every book, naming both characters", async () => {
    renderDialog();

    const dialog = await screen.findByRole("alertdialog", { name: deleteDialog.title });

    expect(
      await within(dialog).findByText(
        deleteDialog.description
          .replace("{source}", RELATIONSHIP_FIXTURE.geralt.name)
          .replace("{target}", RELATIONSHIP_FIXTURE.ciri.name),
      ),
    ).toBeInTheDocument();
  });

  it("says how many books lose their details along with it", async () => {
    renderDialog();

    expect(
      await screen.findByText("Разом із ним буде видалено подробиці для 2 книг."),
    ).toBeInTheDocument();
  });

  it("deletes the whole relationship rather than one book's details", async () => {
    const { onClose, onDeleted } = renderDialog();

    const dialog = await screen.findByRole("alertdialog", { name: deleteDialog.title });
    await userEvent.click(within(dialog).getByRole("button", { name: deleteDialog.confirm }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());

    expect(onDeleted).toHaveBeenCalledOnce();
    expect(writeRequests()).toEqual([{ method: "DELETE", path: PATHS.relationship }]);
  });
});
