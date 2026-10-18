import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { RELATIONSHIP_FIXTURE } from "../model/relationships.fixtures";
import { RemoveRelationshipBookStateDialog } from "./remove-relationship-book-state-dialog";

type SentRequest = { method: string; path: string };

const copy = messages.relationships;
const removeDialog = copy.removeBookStateDialog;

const BOOK = RELATIONSHIP_FIXTURE.book;
const RELATIONSHIP_ID = RELATIONSHIP_FIXTURE.relationshipId;

const BOOK_STATE_PATH = `/api/character-relationships/${RELATIONSHIP_ID}/books/${BOOK.id}`;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderDialog() {
  const onClose = vi.fn<() => void>();
  const onRemoved = vi.fn<() => void>();
  renderWithProviders(
    <RemoveRelationshipBookStateDialog
      bookId={BOOK.id}
      bookTitle={BOOK.title}
      onClose={onClose}
      onRemoved={onRemoved}
      open
      relationshipId={RELATIONSHIP_ID}
    />,
  );
  return { onClose, onRemoved };
}

function sentRequests(): SentRequest[] {
  return fetchMock.mock.calls.map(([input, init]) => ({
    method: (init?.method ?? "GET").toUpperCase(),
    path: new URL(String(input), "http://localhost").pathname,
  }));
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const { pathname } = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "DELETE" && pathname === BOOK_STATE_PATH) {
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

describe("RemoveRelationshipBookStateDialog", () => {
  it("explains that only this book's details go while the relationship stays", async () => {
    renderDialog();

    expect(
      await screen.findByRole("alertdialog", { name: removeDialog.title }),
    ).toHaveAccessibleDescription(removeDialog.description.replace("{book}", BOOK.title));
  });

  it("offers removing from the book, not deleting everywhere", async () => {
    renderDialog();

    const dialog = await screen.findByRole("alertdialog", { name: removeDialog.title });

    expect(within(dialog).getByRole("button", { name: removeDialog.confirm })).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: copy.deleteDialog.confirm }),
    ).not.toBeInTheDocument();
  });

  it("removes only the details of that book", async () => {
    const { onRemoved } = renderDialog();

    const dialog = await screen.findByRole("alertdialog", { name: removeDialog.title });
    await userEvent.click(within(dialog).getByRole("button", { name: removeDialog.confirm }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalledOnce());

    expect(sentRequests()).toEqual([{ method: "DELETE", path: BOOK_STATE_PATH }]);
  });
});
