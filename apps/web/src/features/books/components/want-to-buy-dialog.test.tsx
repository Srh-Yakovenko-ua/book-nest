import { MAX_STORE_LINKS_PER_BOOK, STORE_LINK_ERROR_CODES } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { WantToBuyDialog } from "./want-to-buy-dialog";

const buyDialog = messages.books.details.ownership.buyDialog;
const maxLinksText = messages.books.details.ownership.errors.maxLinks.replace(
  "{max}",
  String(MAX_STORE_LINKS_PER_BOOK),
);
const SERVER_MESSAGE = "Book already has the maximum number of store links";

const book = makeBookView({ ownershipStatus: "none", purchaseInfo: null });

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes(`/api/books/${book.id}/ownership/want-to-buy`) && method === "POST")
      return Promise.resolve(
        jsonResponse(
          { code: STORE_LINK_ERROR_CODES.MAX_LINKS_REACHED, message: SERVER_MESSAGE },
          409,
        ),
      );
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("WantToBuyDialog server errors", () => {
  it("names the store link limit in Ukrainian when the server refuses another link", async () => {
    renderWithProviders(<WantToBuyDialog book={book} onOpenChange={vi.fn()} open />);

    await userEvent.click(screen.getByRole("button", { name: buyDialog.submit }));

    expect(await screen.findByText(maxLinksText)).toBeInTheDocument();
    expect(screen.queryByText(SERVER_MESSAGE)).not.toBeInTheDocument();
  });
});
