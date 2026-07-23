import "@testing-library/jest-dom/vitest";

import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeWishlistSummary } from "@/features/books-to-buy/model/books-to-buy.fixtures";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

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

  it("returns to the publishers list from the not-found panel", async () => {
    respondToDetail = () => Promise.resolve(jsonResponse({ message: "not found" }, 404));

    renderDetails();

    await userEvent.click(await screen.findByRole("button", { name: "До видавництв" }));

    expect(pushMock).toHaveBeenCalledWith("/publishers");
  });
});
