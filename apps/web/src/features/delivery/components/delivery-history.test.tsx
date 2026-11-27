import "@testing-library/jest-dom/vitest";

import type { BookOrderHistorySummaryView } from "@app/shared";
import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { mockIntersectionObserver, renderWithProviders, screen } from "@/test-utils";

import { DeliveryHistory } from "./delivery-history";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

const history = messages.delivery.history;
const fetchMock = vi.fn();

let summary: BookOrderHistorySummaryView;

mockIntersectionObserver();

function emptySummary(): BookOrderHistorySummaryView {
  return {
    cancelledBooksCount: 0,
    cancelledOrdersCount: 0,
    completedOrdersCount: 0,
    completedWithCancellationsCount: 0,
    completedWithoutCancellationsCount: 0,
    latestReceipt: null,
    receivedBooksCount: 0,
    receivedOrdersCount: 0,
    receivedSeriesBooksCount: 0,
    receivedSeriesCount: 0,
    receivedShipmentsCount: 0,
    receivedStandaloneBooksCount: 0,
  };
}

function jsonResponse(body: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  );
}

function renderHistory() {
  return renderWithProviders(
    <NuqsTestingAdapter hasMemory>
      <DeliveryHistory />
    </NuqsTestingAdapter>,
  );
}

beforeEach(() => {
  summary = emptySummary();
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const { pathname } = new URL(String(input), "http://localhost");
    if (pathname === "/api/profile/settings") return jsonResponse(defaultUserProfileSettings);
    if (pathname === "/api/delivery/books/history/summary") return jsonResponse(summary);
    if (pathname === "/api/delivery/books/history/outcome") {
      return jsonResponse({ seriesInsights: [], unreadReceived: null });
    }
    if (pathname === "/api/delivery/books/history/facets") {
      return jsonResponse({ services: [], stores: [] });
    }
    if (pathname === "/api/delivery/books/history") {
      return jsonResponse({
        items: [],
        page: 1,
        pagesCount: 0,
        pageSize: 20,
        totalBooksCount: 0,
        totalCount: 0,
      });
    }
    return Promise.reject(new Error(`unexpected fetch: ${String(input)}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DeliveryHistory on a clean account", () => {
  it("hides the summary cards and the latest receipt block", async () => {
    renderHistory();

    await screen.findByText(history.states.empty.received.title);

    expect(screen.queryByText(history.summary.completed.label)).not.toBeInTheDocument();
    expect(screen.queryByText(history.latestReceipt.title)).not.toBeInTheDocument();
  });

  it("explains that both received and cancelled orders land here", async () => {
    renderHistory();

    const description = await screen.findByText(history.states.empty.received.description);

    expect(description).toHaveTextContent(/отримані/);
    expect(description).toHaveTextContent(/скасовані/);
  });

  it("brings the summary cards back once the history holds orders", async () => {
    summary = { ...emptySummary(), completedOrdersCount: 2, receivedOrdersCount: 2 };
    renderHistory();

    expect(await screen.findAllByText(history.summary.completed.label)).not.toHaveLength(0);
  });
});
