import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeBookView } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, waitFor } from "@/test-utils";

import { makeStoreLink } from "../model/books-to-buy.fixtures";
import { BookStoreLinksBlock } from "./book-store-links-block";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToStoreLinks: () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

beforeEach(() => {
  respondToStoreLinks = () => jsonResponse({ bestOffer: null, storeLinks: [] });
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/store-links") && method === "GET")
      return Promise.resolve(respondToStoreLinks());
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BookStoreLinksBlock", () => {
  it("shows the tracked stores and prices of a wishlist book", async () => {
    respondToStoreLinks = () =>
      jsonResponse({
        bestOffer: { currency: "UAH", price: 450 },
        storeLinks: [makeStoreLink({ price: 450, storeName: "Yakaboo" })],
      });

    renderWithProviders(
      <BookStoreLinksBlock book={makeBookView({ ownershipStatus: "want_to_buy" })} />,
    );

    expect(await screen.findByText("Магазини та ціни")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Yakaboo/ })).toBeInTheDocument();
  });

  it("stays hidden for an owned book that tracks no store", async () => {
    renderWithProviders(<BookStoreLinksBlock book={makeBookView({ ownershipStatus: "owned" })} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText("Магазини та ціни")).not.toBeInTheDocument();
  });
});
