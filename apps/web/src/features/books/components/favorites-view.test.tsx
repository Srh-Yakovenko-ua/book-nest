import "@testing-library/jest-dom/vitest";

import type { FavoritesSummaryView, LibraryQuickCounts } from "@app/shared";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor, within } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { FavoritesView } from "./favorites-view";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/favorites",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const fetchMock = vi.fn();

const QUICK_COUNTS: LibraryQuickCounts = {
  all: 6,
  borrowed: 0,
  favorites: 6,
  finished: 2,
  in_transit: 0,
  reading: 3,
  series: 4,
  solo: 2,
  want_to_buy: 0,
  want_to_read: 1,
};

const FAVORITES_SUMMARY: FavoritesSummaryView = {
  averageRating: null,
  finished: 21,
  reading: 22,
  series: 23,
  solo: 24,
  topGenres: [],
  topTags: [],
  total: 47,
  unrated: 0,
  wantToRead: 25,
};

function chip(name: string): HTMLElement {
  const match = screen
    .getAllByRole("radio")
    .find((radio) => radio.firstChild?.textContent === name);
  if (match === undefined) throw new Error(`No quick filter chip ${name}`);
  return match;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function mockApi() {
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/books/quick-counts")
      return Promise.resolve(jsonResponse(QUICK_COUNTS));
    if (url.pathname === "/api/books/favorites-summary") {
      return Promise.resolve(jsonResponse(FAVORITES_SUMMARY));
    }
    if (url.pathname === "/api/books") {
      return Promise.resolve(
        jsonResponse({
          items: [makeBookView({ isFavorite: true })],
          page: 1,
          pagesCount: 1,
          pageSize: 24,
          totalCount: 1,
        }),
      );
    }
    return Promise.resolve(jsonResponse([]));
  });
}

function quickCountRequests(): URL[] {
  return fetchMock.mock.calls
    .map(([input]) => new URL(String(input), "http://localhost"))
    .filter((url) => url.pathname === "/api/books/quick-counts");
}

function renderFavorites() {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory>
      <FavoritesView />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FavoritesView quick filter counts", () => {
  it("counts the chips over the favorite books and keeps the summary cards on the summary", async () => {
    mockApi();
    renderFavorites();

    await waitFor(() => expect(within(chip("Усі")).getByText("6")).toBeInTheDocument());
    expect(within(chip("Читаю")).getByText("3")).toBeInTheDocument();
    expect(screen.getAllByText("47").length).toBeGreaterThan(0);
    expect(screen.getAllByText("22").length).toBeGreaterThan(0);

    const [request] = quickCountRequests();
    expect(request?.searchParams.get("scope")).toBe("favorites");
    expect(request?.searchParams.has("isFavorite")).toBe(false);
  });

  it("keeps the selected chip out of the quick-counts request", async () => {
    mockApi();
    renderFavorites();
    await waitFor(() => expect(within(chip("Усі")).getByText("6")).toBeInTheDocument());

    await userEvent.click(chip("Прочитано"));
    await waitFor(() => expect(chip("Прочитано")).toHaveAttribute("data-state", "on"));

    for (const url of quickCountRequests()) {
      expect(url.searchParams.has("status")).toBe(false);
      expect(url.searchParams.get("scope")).toBe("favorites");
    }
  });
});
