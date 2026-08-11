import "@testing-library/jest-dom/vitest";

import type { WishlistBookView, WishlistSummaryView } from "@app/shared";
import type { OnUrlUpdateFunction } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
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

function renderWishlist(searchParams = "", onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter onUrlUpdate={onUrlUpdate} searchParams={searchParams}>
      <BooksToBuyView />
    </NuqsTestingAdapter>,
  );
}

function wishlistCallCount() {
  return fetchMock.mock.calls.filter(([url]) => {
    const value = String(url);
    return value.includes("/api/books/wishlist") && !value.includes("/facets");
  }).length;
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
    if (url.includes("/api/books/wishlist/facets")) {
      return Promise.resolve(jsonResponse({ stores: [] }));
    }
    if (url.includes("/api/tags")) {
      return Promise.resolve(
        jsonResponse({ items: [], page: 1, pagesCount: 1, pageSize: 20, totalCount: 0 }),
      );
    }
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

    renderWishlist();

    expect(await screen.findByRole("heading", { name: "Альфа" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Бета" })).toBeInTheDocument();
  });

  it("switches between grid cards and horizontal list rows", async () => {
    renderWishlist();

    expect(await screen.findByRole("heading", { name: "Останнє бажання" })).toBeInTheDocument();
    expect(document.querySelector("[data-slot=book-card]")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Список" }));

    expect(document.querySelector("[data-slot=book-row]")).toBeInTheDocument();
    expect(document.querySelector("[data-slot=book-card]")).not.toBeInTheDocument();
  });

  it("shows a busy skeleton while the wishlist loads", () => {
    respondToWishlist = () => new Promise<Response>(() => {});

    renderWishlist();

    expect(document.querySelector("[aria-busy]")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Посилання та ціни" })).toBeNull();
  });

  it("announces a failed wishlist load and hides the toolbar and sidebar", async () => {
    respondToWishlist = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWishlist();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Не вдалося завантажити")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Посилання та ціни" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Огляд бажань" })).toBeNull();
  });

  it("refetches the wishlist when the reader retries", async () => {
    respondToWishlist = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWishlist();

    const alert = await screen.findByRole("alert");
    const callsBeforeRetry = wishlistCallCount();
    await userEvent.click(within(alert).getByRole("button", { name: "Спробувати ще раз" }));

    await waitFor(() => expect(wishlistCallCount()).toBeGreaterThan(callsBeforeRetry));
  });

  it("invites the reader to add a book when the wishlist is empty", async () => {
    respondToWishlist = () => Promise.resolve(jsonResponse(wishlistOf([])));

    renderWishlist();

    expect(await screen.findByText("Збережи книги для майбутніх покупок")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "Посилання та ціни" })).toBeNull();
  });

  it("shows the wishlist overview alongside a loaded wishlist", async () => {
    renderWishlist();

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

    renderWishlist();

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

  it("repeats the same four stats on the narrow tiles the desktop cards show", async () => {
    renderWishlist();

    await screen.findByText("Усього в списку");

    for (const tile of ["Книги", "Пропущені", "Наступні", "Давно"]) {
      expect(screen.getByText(tile)).toBeInTheDocument();
    }
  });

  it("tells a filtered-out wishlist apart from an empty one", async () => {
    respondToWishlist = () =>
      Promise.resolve(jsonResponse({ ...wishlistOf([]), totalBooksCount: 1 }));

    renderWishlist("?link=without_links");

    expect(await screen.findByText("Нічого не знайдено")).toBeInTheDocument();
    expect(await screen.findByText(/^Показано 0 з /)).toBeInTheDocument();
    expect(screen.queryByText("Збережи книги для майбутніх покупок")).not.toBeInTheDocument();
  });

  it("drops every filter from the url when the reader clears a filtered-out list", async () => {
    respondToWishlist = () =>
      Promise.resolve(jsonResponse({ ...wishlistOf([]), totalBooksCount: 1 }));
    const events: string[] = [];

    renderWishlist("?link=without_links", (event) => {
      events.push(event.queryString);
    });

    await userEvent.click(await screen.findByRole("button", { name: "Очистити фільтри" }));

    await waitFor(() => expect(events.at(-1)).toBe(""));
  });

  it("hands the chosen sort to the endpoint", async () => {
    respondToWishlist = () => Promise.resolve(jsonResponse(wishlistOf([makeWishlistBook()])));

    renderWishlist("?sort=price_asc");

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("sort=price_asc"))).toBe(
        true,
      ),
    );
  });

  it("keeps a filter chip for every applied filter", async () => {
    respondToWishlist = () => Promise.resolve(jsonResponse(wishlistOf([makeWishlistBook()])));

    renderWishlist("?link=has_price&currency=USD");

    const chips = await screen.findByRole("group", { name: "Активні фільтри" });
    expect(within(chips).getByText("З ціною")).toBeInTheDocument();
    expect(within(chips).getByText("USD")).toBeInTheDocument();
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

    renderWishlist();

    await userEvent.click(await screen.findByRole("button", { name: "Фільтри" }));
    const chips = screen.getByRole("radiogroup", {
      name: "Посилання та ціни",
    });
    await userEvent.click(within(chips).getByRole("radio", { name: "Є посилання" }));
    await userEvent.click(screen.getByRole("button", { name: "Застосувати фільтри" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes("link=has_links"))).toBe(
        true,
      ),
    );
  });
});
