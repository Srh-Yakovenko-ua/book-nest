import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeWishlistSummary } from "@/features/books-to-buy/model/books-to-buy.fixtures";
import { createTestQueryClient, renderWithProviders, screen, userEvent } from "@/test-utils";

import { publisherKeys } from "../api/publisher-keys";
import { makePublisherDetail } from "../model/publisher.fixtures";
import { PublisherDetails } from "./publisher-details";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  usePathname: () => "/publishers/publisher-1",
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

const fetchMock = vi.fn();

let respondToDetail: () => Promise<Response>;

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

function renderDetails(id = "publisher-1") {
  return renderWithProviders(
    <NuqsTestingAdapter>
      <PublisherDetails id={id} />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  respondToDetail = () => Promise.resolve(jsonResponse(makePublisherDetail()));

  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/library-detail")) return respondToDetail();
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

describe("PublisherDetails", () => {
  it("shows a busy state while the publisher loads", () => {
    respondToDetail = () => new Promise<Response>(() => {});

    renderDetails();

    expect(screen.getByLabelText("Завантаження видавництва")).toBeInTheDocument();
  });

  it("renders the loaded publisher hero", async () => {
    respondToDetail = () => Promise.resolve(jsonResponse(makePublisherDetail({ name: "Vivat" })));

    renderDetails();

    expect(await screen.findByRole("heading", { level: 1, name: "Vivat" })).toBeInTheDocument();
  });

  it("shows a not-found panel when the publisher is missing", async () => {
    respondToDetail = () => Promise.resolve(jsonResponse({ message: "not found" }, 404));

    renderDetails();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Видавництво не знайдено");
  });

  it("links back to the publishers list from the not-found panel", async () => {
    respondToDetail = () => Promise.resolve(jsonResponse({ message: "not found" }, 404));

    renderDetails();

    expect(await screen.findByRole("link", { name: "До видавництв" })).toHaveAttribute(
      "href",
      "/publishers",
    );
    expect(screen.queryByRole("button", { name: "Спробувати ще раз" })).not.toBeInTheDocument();
  });

  it("retries a failed initial load through a refetch", async () => {
    let attempts = 0;
    respondToDetail = () => {
      attempts += 1;
      return Promise.resolve(
        attempts === 1
          ? jsonResponse({ message: "boom" }, 500)
          : jsonResponse(makePublisherDetail({ name: "Vivat" })),
      );
    };

    renderDetails();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не вдалося завантажити видавництво",
    );
    expect(screen.getByRole("link", { name: "До видавництв" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Спробувати ще раз" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Vivat" })).toBeInTheDocument();
    expect(attempts).toBe(2);
  });

  it("does not start book requests while the publisher is pending", () => {
    respondToDetail = () => new Promise<Response>(() => {});

    renderDetails();

    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.every((url) => url.includes("/library-detail"))).toBe(true);
  });

  it("keeps the page rendered when a background refetch fails", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      publisherKeys.detail("publisher-1"),
      makePublisherDetail({ name: "Vivat" }),
    );
    respondToDetail = () => Promise.resolve(jsonResponse({ message: "boom" }, 500));

    renderWithProviders(
      <NuqsTestingAdapter>
        <PublisherDetails id="publisher-1" />
      </NuqsTestingAdapter>,
      { queryClient },
    );

    await queryClient.refetchQueries({ queryKey: publisherKeys.detail("publisher-1") });

    expect(screen.getByRole("heading", { level: 1, name: "Vivat" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
