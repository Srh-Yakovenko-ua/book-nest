import "@testing-library/jest-dom/vitest";

import type { LibraryPublisherDetail } from "@app/shared";
import type { OnUrlUpdateFunction, UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeWishlistSummary } from "@/features/books-to-buy/model/books-to-buy.fixtures";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makePublisherDetail, makePublisherStats } from "../model/publisher.fixtures";
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

function emptyBooksPage() {
  return { items: [], page: 1, pagesCount: 1, pageSize: 20, totalCount: 0 };
}

function emptyWishlist() {
  return { books: [], summary: makeWishlistSummary({ booksCount: 0 }) };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function renderView(details: LibraryPublisherDetail, onUrlUpdate?: OnUrlUpdateFunction) {
  return renderWithProviders(
    <NuqsTestingAdapter onUrlUpdate={onUrlUpdate}>
      <PublisherDetailsView details={details} />
    </NuqsTestingAdapter>,
  );
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
    if (url.includes("/api/books/wishlist")) return Promise.resolve(jsonResponse(emptyWishlist()));
    if (url.includes("/api/books")) return Promise.resolve(jsonResponse(emptyBooksPage()));
    if (url.includes("/api/genres")) return Promise.resolve(jsonResponse([]));
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("PublisherDetailsView", () => {
  it("offers edit and delete for a custom publisher", () => {
    renderView(makePublisherDetail({ isCustom: true }));

    expect(screen.getByRole("button", { name: "Редагувати" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Видалити" })).toBeInTheDocument();
  });

  it("hides edit and delete for a read-only global publisher", () => {
    renderView(makePublisherDetail({ isCustom: false }));

    expect(screen.queryByRole("button", { name: "Редагувати" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Видалити" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Додати книгу" })).toBeInTheDocument();
  });

  it("renders the hero details from the loaded publisher", () => {
    renderView(
      makePublisherDetail({ foundedYear: 1996, name: "Vivat", websiteUrl: "https://vivat.com.ua" }),
    );

    expect(screen.getByRole("heading", { level: 1, name: "Vivat" })).toBeInTheDocument();
    expect(screen.getByText("Засновано 1996")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Сайт" })).toHaveAttribute(
      "href",
      "https://vivat.com.ua",
    );
  });

  it("renders a KPI value from the publisher stats", () => {
    renderView(
      makePublisherDetail({
        stats: makePublisherStats({ averageRating: null, lastBookAddedAt: null, queueCount: 7 }),
      }),
    );

    expect(screen.getByText("У черзі")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("moves to the books tab through the url", async () => {
    const { events, onUrlUpdate } = trackUrl();
    renderView(makePublisherDetail(), onUrlUpdate);

    await userEvent.click(screen.getByRole("tab", { name: "Книги" }));

    await waitFor(() => expect(events.length).toBeGreaterThan(0));
    expect(events.at(-1)?.searchParams.get("tab")).toBe("books");
  });

  it("moves to the to-buy tab through the url", async () => {
    const { events, onUrlUpdate } = trackUrl();
    renderView(makePublisherDetail(), onUrlUpdate);

    await userEvent.click(screen.getByRole("tab", { name: "Бажані" }));

    await waitFor(() => expect(events.length).toBeGreaterThan(0));
    expect(events.at(-1)?.searchParams.get("tab")).toBe("toBuy");
  });

  it("prefills the publisher when adding a book from the detail page", async () => {
    renderView(makePublisherDetail({ id: "publisher-42" }));

    await userEvent.click(screen.getByRole("button", { name: "Додати книгу" }));

    expect(pushMock).toHaveBeenCalledWith("/books/new?publisherId=publisher-42");
  });
});
