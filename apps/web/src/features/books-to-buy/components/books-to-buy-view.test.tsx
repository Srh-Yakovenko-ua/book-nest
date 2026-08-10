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

let respondToWishlist: (url: string) => Promise<Response>;

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
    totalBooksCount: books.length,
  };
}

beforeEach(() => {
  respondToWishlist = () => Promise.resolve(jsonResponse(wishlistOf([makeWishlistBook()])));
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/genres")) return Promise.resolve(jsonResponse(DETAILS_GENRES_FIXTURE));
    if (url.includes("/api/books/wishlist")) return respondToWishlist(url);
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

  it("switches between grid cards and horizontal list rows", async () => {
    renderWithProviders(<BooksToBuyView />);

    expect(await screen.findByRole("heading", { name: "Останнє бажання" })).toBeInTheDocument();
    expect(document.querySelector("[data-slot=book-card]")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Список" }));

    expect(document.querySelector("[data-slot=book-row]")).toBeInTheDocument();
    expect(document.querySelector("[data-slot=book-card]")).not.toBeInTheDocument();
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

  it("sums up the wishlist in four cards above the list", async () => {
    respondToWishlist = () =>
      Promise.resolve(
        jsonResponse(
          wishlistOf([makeWishlistBook()], {
            booksCount: 33,
            counts: {
              addedLast30Days: 5,
              missingFromSeries: { booksCount: 4, seriesCount: 2 },
              nextInSeries: { booksCount: 7, seriesCount: 3 },
              waitingOverSixMonths: 9,
            },
          }),
        ),
      );

    renderWithProviders(<BooksToBuyView />);

    const total = await screen.findByText("Усього в списку");
    expect(total.closest("[data-slot=stat-card]")).toHaveTextContent("33книги");
    expect(total.closest("[data-slot=stat-card]")).toHaveTextContent("+5 за останні 30 днів");

    const missing = screen.getByText("Пропущені в серіях");
    expect(missing.closest("[data-slot=stat-card]")).toHaveTextContent("4книги");
    expect(missing.closest("[data-slot=stat-card]")).toHaveTextContent(
      "Закривають пропуски у 2 серіях",
    );

    const next = screen.getByText("Наступні в серіях");
    expect(next.closest("[data-slot=stat-card]")).toHaveTextContent("7книг");
    expect(next.closest("[data-slot=stat-card]")).toHaveTextContent("Продовжують 3 серії");

    const waiting = screen.getByText("Давно чекають");
    expect(waiting.closest("[data-slot=stat-card]")).toHaveTextContent("9книг");
    expect(waiting.closest("[data-slot=stat-card]")).toHaveTextContent("Понад 6 місяців у списку");
  });

  it("tells a filtered-out wishlist apart from an empty one and restores it on reset", async () => {
    respondToWishlist = (url) =>
      Promise.resolve(
        jsonResponse(
          url.includes("link=without_links")
            ? { ...wishlistOf([]), totalBooksCount: 1 }
            : wishlistOf([
                makeWishlistBook({
                  id: "alpha",
                  storeLinks: [makeStoreLink({ id: "link-alpha" })],
                  title: "Альфа",
                }),
              ]),
        ),
      );

    renderWithProviders(<BooksToBuyView />);

    expect(await screen.findByText("Показано 1 з 1 книги")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Фільтри" }));
    const chips = screen.getByRole("radiogroup", {
      name: "Фільтр за посиланнями та цінами",
    });
    await userEvent.click(within(chips).getByRole("radio", { name: /Без посилань/ }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати фільтри" }));

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
    expect(await screen.findByText(/^Показано 0 з /)).toBeInTheDocument();
    expect(screen.queryByText("Збережи книги для майбутніх покупок")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Очистити фільтри" }));

    expect(await screen.findByRole("heading", { name: "Альфа" })).toBeInTheDocument();
  });

  it("sends link filters to the wishlist endpoint", async () => {
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

    await userEvent.click(await screen.findByRole("button", { name: "Фільтри" }));
    const chips = screen.getByRole("radiogroup", {
      name: "Фільтр за посиланнями та цінами",
    });
    await userEvent.click(within(chips).getByRole("radio", { name: "Є посилання" }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати фільтри" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes("/api/books/wishlist?link=has_links"),
        ),
      ).toBe(true),
    );
  });
});
