import "@testing-library/jest-dom/vitest";

import type { WishlistBookView, WishlistSummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DETAILS_GENRES_FIXTURE } from "@/features/books/components/book-details.fixtures";
import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import {
  makeStoreLink,
  makeWishlistBook,
  makeWishlistSummary,
} from "../model/books-to-buy.fixtures";
import { BooksToBuyView } from "./books-to-buy-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToWishlist: () => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function wishlistCallCount() {
  return fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/books/wishlist")).length;
}

function wishlistOf(books: WishlistBookView[], summary?: Partial<WishlistSummaryView>) {
  return {
    books,
    summary: makeWishlistSummary({ booksCount: books.length, ...summary }),
  };
}

beforeEach(() => {
  respondToWishlist = () => Promise.resolve(jsonResponse(wishlistOf([makeWishlistBook()])));
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/genres")) return Promise.resolve(jsonResponse(DETAILS_GENRES_FIXTURE));
    if (url.includes("/api/books/wishlist")) return respondToWishlist();
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BooksToBuyView", () => {
  it("lists the wishlist books once they arrive", async () => {
    respondToWishlist = () =>
      Promise.resolve(
        jsonResponse(
          wishlistOf([
            makeWishlistBook({
              createdAt: "2026-03-01T00:00:00.000Z",
              id: "alpha",
              title: "Альфа",
            }),
            makeWishlistBook({ createdAt: "2026-03-02T00:00:00.000Z", id: "beta", title: "Бета" }),
          ]),
        ),
      );

    renderWithProviders(<BooksToBuyView />);

    expect(await screen.findByRole("heading", { name: "Альфа" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Бета" })).toBeInTheDocument();
  });

  it("shows a busy skeleton while the wishlist loads", () => {
    respondToWishlist = () => new Promise<Response>(() => {});

    renderWithProviders(<BooksToBuyView />);

    expect(document.querySelector("[aria-busy]")).toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Фільтр за посиланнями та цінами" }),
    ).toBeNull();
  });

  it("announces a failed wishlist load and hides the toolbar and sidebar", async () => {
    respondToWishlist = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<BooksToBuyView />);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Не вдалося завантажити")).toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Фільтр за посиланнями та цінами" }),
    ).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Огляд бажань" })).toBeNull();
  });

  it("refetches the wishlist when the reader retries", async () => {
    respondToWishlist = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(<BooksToBuyView />);

    const alert = await screen.findByRole("alert");
    const callsBeforeRetry = wishlistCallCount();
    await userEvent.click(within(alert).getByRole("button", { name: "Спробувати ще раз" }));

    await waitFor(() => expect(wishlistCallCount()).toBeGreaterThan(callsBeforeRetry));
  });

  it("invites the reader to add a book when the wishlist is empty", async () => {
    respondToWishlist = () => Promise.resolve(jsonResponse(wishlistOf([])));

    renderWithProviders(<BooksToBuyView />);

    expect(await screen.findByText("Збережи книги для майбутніх покупок")).toBeInTheDocument();
    expect(
      screen.queryByRole("radiogroup", { name: "Фільтр за посиланнями та цінами" }),
    ).toBeNull();
  });

  it("shows the wishlist overview alongside a loaded wishlist", async () => {
    renderWithProviders(<BooksToBuyView />);

    expect(await screen.findByRole("complementary", { name: "Огляд бажань" })).toBeInTheDocument();
  });

  it("tells a filtered-out wishlist apart from an empty one and restores it on reset", async () => {
    respondToWishlist = () =>
      Promise.resolve(
        jsonResponse(
          wishlistOf([
            makeWishlistBook({
              id: "alpha",
              storeLinks: [makeStoreLink({ id: "link-alpha" })],
              title: "Альфа",
            }),
          ]),
        ),
      );

    renderWithProviders(<BooksToBuyView />);

    const chips = await screen.findByRole("radiogroup", {
      name: "Фільтр за посиланнями та цінами",
    });
    await userEvent.click(within(chips).getByRole("radio", { name: /Без посилань/ }));

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
    expect(screen.queryByText("Збережи книги для майбутніх покупок")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Очистити фільтри" }));

    expect(await screen.findByRole("heading", { name: "Альфа" })).toBeInTheDocument();
  });

  it("counts the matches on each link filter chip", async () => {
    respondToWishlist = () =>
      Promise.resolve(
        jsonResponse(
          wishlistOf([
            makeWishlistBook({
              id: "linked",
              storeLinks: [makeStoreLink({ id: "link-1" })],
              title: "З посиланням",
            }),
            makeWishlistBook({ id: "bare", storeLinks: [], title: "Без посилання" }),
          ]),
        ),
      );

    renderWithProviders(<BooksToBuyView />);

    const chips = await screen.findByRole("radiogroup", {
      name: "Фільтр за посиланнями та цінами",
    });
    expect(within(chips).getByRole("radio", { name: /Усі/ })).toHaveTextContent("2");
    expect(within(chips).getByRole("radio", { name: /Є посилання/ })).toHaveTextContent("1");
  });
});
