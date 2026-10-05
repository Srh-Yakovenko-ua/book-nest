import "@testing-library/jest-dom/vitest";

import type { LibraryPublisherDetail } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makePublisherDetail, makePublisherDetailStats } from "../model/publisher.fixtures";
import { PublisherDetailsView } from "./publisher-details-view";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/publishers/publisher-1",
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const fetchMock = vi.fn();

function booksOverview() {
  return {
    recentlyAdded: [],
    summary: {
      borrowed: 0,
      favorites: 0,
      finished: 0,
      inTransit: 0,
      reading: 0,
      series: 0,
      solo: 0,
      total: 0,
      wantToBuy: 0,
      wantToRead: 0,
    },
    topGenres: [],
    topTags: [],
  };
}

function booksQuickCounts() {
  return {
    all: 0,
    borrowed: 0,
    favorites: 0,
    finished: 0,
    in_transit: 0,
    reading: 0,
    series: 0,
    solo: 0,
    want_to_buy: 0,
    want_to_read: 0,
  };
}

function emptyBooksPage() {
  return { items: [], page: 1, pagesCount: 1, pageSize: 20, totalCount: 0 };
}

function emptyOverview() {
  return { activeReading: [], latestBook: null, series: [], wishlist: [] };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function overviewRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes("/library-overview"));
}

function renderView(
  details: LibraryPublisherDetail,
  options: { onUrlUpdate?: OnUrlUpdateFunction; searchParams?: string } = {},
) {
  return renderWithProviders(
    <NuqsTestingAdapter onUrlUpdate={options.onUrlUpdate} searchParams={options.searchParams}>
      <PublisherDetailsView details={details} />
    </NuqsTestingAdapter>,
  );
}

function statCardLabel(label: string) {
  return screen.getByText(label, { selector: "[data-slot=stat-card] *" });
}

function trackUrl() {
  const events: UrlUpdateEvent[] = [];
  const onUrlUpdate: OnUrlUpdateFunction = (event) => {
    events.push(event);
  };
  return { events, onUrlUpdate };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/library-overview")) return Promise.resolve(jsonResponse(emptyOverview()));
    if (url.includes("/api/books/overview")) return Promise.resolve(jsonResponse(booksOverview()));
    if (url.includes("/api/books/quick-counts")) {
      return Promise.resolve(jsonResponse(booksQuickCounts()));
    }
    if (url.includes("/api/books/facets")) {
      return Promise.resolve(jsonResponse({ authors: [], genres: [] }));
    }
    if (url.includes("/api/books")) return Promise.resolve(jsonResponse(emptyBooksPage()));
    if (url.includes("/api/genres")) return Promise.resolve(jsonResponse([]));
    if (url.includes("/api/publishers")) return Promise.resolve(jsonResponse(emptyBooksPage()));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PublisherDetailsView", () => {
  describe("hero", () => {
    it("keeps edit, merge and delete in the overflow menu of a custom publisher", async () => {
      renderView(makePublisherDetail({ isCustom: true }));

      expect(screen.queryByRole("button", { name: "Редагувати" })).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Дії з видавництвом" }));

      expect(await screen.findByRole("menuitem", { name: "Редагувати" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Обʼєднати з іншим" })).toBeInTheDocument();
      expect(screen.getByRole("menuitem", { name: "Видалити" })).toBeInTheDocument();
    });

    it("opens the merge dialog from the overflow menu", async () => {
      renderView(makePublisherDetail({ isCustom: true }));

      await userEvent.click(screen.getByRole("button", { name: "Дії з видавництвом" }));
      await userEvent.click(await screen.findByRole("menuitem", { name: "Обʼєднати з іншим" }));

      expect(await screen.findByRole("dialog", { name: "Обʼєднати видавництво" })).toBeVisible();
    });

    it.each([
      { dialog: "dialog", item: "Редагувати" },
      { dialog: "alertdialog", item: "Видалити" },
    ] as const)(
      "returns focus to the actions menu when the $item dialog is cancelled",
      async ({ dialog, item }) => {
        renderView(makePublisherDetail({ isCustom: true, stats: makePublisherDetailStats() }));
        const menuTrigger = screen.getByRole("button", { name: "Дії з видавництвом" });

        await userEvent.click(menuTrigger);
        await userEvent.click(await screen.findByRole("menuitem", { name: item }));
        expect(await screen.findByRole(dialog)).toBeInTheDocument();
        await userEvent.keyboard("{Escape}");

        await waitFor(() => expect(screen.queryByRole(dialog)).not.toBeInTheDocument());
        await waitFor(() => expect(menuTrigger).toHaveFocus());
      },
    );

    it("offers only add book for a read-only global publisher", () => {
      renderView(makePublisherDetail({ isCustom: false }));

      expect(screen.queryByRole("button", { name: "Дії з видавництвом" })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: "Обʼєднати з іншим" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Додати книгу" })).toBeInTheDocument();
    });

    it("renders the identity with a single h1 and no back link or custom badge", () => {
      renderView(
        makePublisherDetail({
          countryCode: "UA",
          foundedYear: 1996,
          isCustom: true,
          name: "Vivat",
          websiteUrl: "https://vivat.com.ua",
        }),
      );

      expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
      expect(screen.getByRole("heading", { level: 1, name: "Vivat" })).toBeInTheDocument();
      expect(screen.getByText("Засновано у 1996 році.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /новій вкладці/ })).toHaveAttribute(
        "href",
        "https://vivat.com.ua",
      );
      expect(screen.queryByText("Власне")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Усі видавництва" })).not.toBeInTheDocument();
    });

    it("omits a missing country, founded year and website", () => {
      renderView(makePublisherDetail({ countryCode: null, foundedYear: null, websiteUrl: null }));

      expect(screen.queryByText(/Засновано/)).not.toBeInTheDocument();
      expect(screen.queryByText("Країна невідома")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /новій вкладці/ })).not.toBeInTheDocument();
    });

    it("prefills the publisher when adding a book from the detail page", async () => {
      renderView(makePublisherDetail({ id: "publisher-42" }));

      await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));

      expect(pushMock).toHaveBeenCalledWith("/books/new?publisherId=publisher-42");
    });
  });

  describe("stats", () => {
    it("renders exactly the four detail cards with derived microfacts", () => {
      renderView(
        makePublisherDetail({
          stats: makePublisherDetailStats({
            averageRating: 4.25,
            booksCount: 3,
            lastBookAddedAt: "2026-05-04",
            readCount: 1,
            wantToBuyCount: 2,
            wishlistWithoutPriceCount: 1,
          }),
        }),
      );

      expect(statCardLabel("Книг у бібліотеці")).toBeInTheDocument();
      expect(statCardLabel("Прочитано")).toBeInTheDocument();
      expect(statCardLabel("У списку бажань")).toBeInTheDocument();
      expect(statCardLabel("Середній рейтинг")).toBeInTheDocument();
      expect(screen.queryByText("У черзі")).not.toBeInTheDocument();
      expect(screen.getByText(/^Останню додано/)).toBeInTheDocument();
      expect(screen.getByText("33% від усіх книг")).toBeInTheDocument();
      expect(screen.getByText("1 без ціни")).toBeInTheDocument();
      expect(screen.getByText("Серед книг цього видавництва з оцінкою")).toBeInTheDocument();
    });

    it("shows a zero read share and no rating without rated books", () => {
      renderView(
        makePublisherDetail({
          stats: makePublisherDetailStats({
            averageRating: null,
            booksCount: 4,
            readCount: 0,
            wishlistWithoutPriceCount: 0,
          }),
        }),
      );

      expect(screen.getByText("0% від усіх книг")).toBeInTheDocument();
      expect(screen.getByText("Немає оцінених книг")).toBeInTheDocument();
      expect(screen.queryByText(/без ціни/)).not.toBeInTheDocument();
    });
  });

  describe("catalog and url", () => {
    it("renders the books catalog directly, without a tab list", async () => {
      renderView(makePublisherDetail());

      expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
      expect(screen.queryByRole("tab")).not.toBeInTheDocument();
      expect(
        await screen.findByPlaceholderText("Назва книги, автор або серія"),
      ).toBeInTheDocument();
    });

    it("replaces the legacy wishlist tab with the wishlist owner filter", async () => {
      const { events, onUrlUpdate } = trackUrl();
      renderView(makePublisherDetail(), { onUrlUpdate, searchParams: "?tab=toBuy" });

      await waitFor(() => expect(events.length).toBeGreaterThan(0));
      const event = events.at(-1);
      expect(event?.searchParams.has("tab")).toBe(false);
      expect(event?.searchParams.get("owner")).toBe("want_to_buy");
      expect(event?.options.history).toBe("replace");
    });

    it("replaces a legacy books tab away and keeps the catalog params", async () => {
      const { events, onUrlUpdate } = trackUrl();
      renderView(makePublisherDetail(), { onUrlUpdate, searchParams: "?tab=books&q=dune" });

      await waitFor(() => expect(events.length).toBeGreaterThan(0));
      expect(events.at(-1)?.queryString).toBe("?q=dune");
      expect(events.at(-1)?.options.history).toBe("replace");
    });

    it("never keeps the fixed publisher as a books url param", async () => {
      const { events, onUrlUpdate } = trackUrl();
      renderView(makePublisherDetail(), { onUrlUpdate, searchParams: "?publisher=publisher-1" });

      await waitFor(() => expect(events.length).toBeGreaterThan(0));
      expect(events.at(-1)?.searchParams.has("publisher")).toBe(false);
      expect(events.at(-1)?.options.history).toBe("replace");
    });
  });

  describe("zero books", () => {
    it("shows one empty state and sends no overview request", async () => {
      renderView(
        makePublisherDetail({
          id: "publisher-7",
          stats: makePublisherDetailStats({
            averageRating: null,
            booksCount: 0,
            lastBookAddedAt: null,
            readCount: 0,
            wantToBuyCount: 0,
          }),
        }),
      );

      expect(await screen.findByText("Ще немає книг цього видавництва")).toBeInTheDocument();
      expect(
        screen.getByText("Додайте першу книгу цього видавництва до своєї бібліотеки."),
      ).toBeInTheDocument();
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
      expect(screen.queryByText(/Останню додано/)).not.toBeInTheDocument();
      expect(screen.queryByText(/від усіх книг/)).not.toBeInTheDocument();

      const [, emptyStateAddBook] = screen.getAllByRole("button", { name: "Додати книгу" });
      expect(emptyStateAddBook).toBeDefined();
      if (emptyStateAddBook !== undefined) await userEvent.click(emptyStateAddBook);

      expect(pushMock).toHaveBeenCalledWith("/books/new?publisherId=publisher-7");
      expect(overviewRequests()).toEqual([]);
    });
  });
});
