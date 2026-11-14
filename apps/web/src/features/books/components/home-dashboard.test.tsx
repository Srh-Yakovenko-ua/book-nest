import "@testing-library/jest-dom/vitest";

import type { LibraryOverviewView } from "@app/shared";
import type { ReactNode } from "react";

import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeDeliveryInTransitSummary } from "@/features/delivery/components/delivery.fixtures";
import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { HomeDashboard } from "./home-dashboard";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const summaryError = messages.books.library.summaryError;
const summaryLabels = messages.books.library.summary;

const OVERVIEW: LibraryOverviewView = {
  recentlyAdded: [],
  summary: {
    borrowed: 2,
    favorites: 8,
    finished: 12,
    inTransit: 1,
    reading: 5,
    series: 20,
    solo: 17,
    total: 37,
    wantToBuy: 3,
    wantToRead: 9,
  },
  topGenres: [],
  topTags: [],
};

const fetchMock = vi.fn();
const overview = { fails: false };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function progressLabel(finished: number, total: number): string {
  return messages.home.progress.label
    .replace("{finished}", String(finished))
    .replace("{total}", String(total));
}

beforeEach(() => {
  overview.fails = false;
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    if (url.pathname === "/api/books/overview") {
      return Promise.resolve(
        overview.fails ? jsonResponse({ message: "boom" }, 500) : jsonResponse(OVERVIEW),
      );
    }
    if (url.pathname === "/api/delivery/books/in-transit/summary") {
      return Promise.resolve(jsonResponse(makeDeliveryInTransitSummary()));
    }
    return Promise.reject(new Error(`unexpected fetch: ${url.pathname}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("HomeDashboard library summary", () => {
  it("shows the summary error instead of zero totals when the overview fails to load", async () => {
    overview.fails = true;
    renderWithProviders(<HomeDashboard />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(summaryError.title);
    expect(alert).toHaveTextContent(summaryError.description);
    expect(within(alert).getByRole("button", { name: summaryError.retry })).toBeInTheDocument();
    expect(screen.queryByText(summaryLabels.total)).not.toBeInTheDocument();
    expect(screen.queryByText(progressLabel(0, 0))).not.toBeInTheDocument();
  });

  it("shows the real totals once a retry reaches the recovered overview", async () => {
    overview.fails = true;
    renderWithProviders(<HomeDashboard />);
    const retry = await screen.findByRole("button", { name: summaryError.retry });

    overview.fails = false;
    await userEvent.click(retry);

    expect(await screen.findByText(progressLabel(12, 37))).toBeInTheDocument();
    expect(screen.getAllByText("37").length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the totals and shows the refetch banner when a background refresh fails", async () => {
    const { queryClient } = renderWithProviders(<HomeDashboard />);
    await screen.findByText(progressLabel(12, 37));

    overview.fails = true;
    await act(() => queryClient.refetchQueries());

    expect(await screen.findByText(messages.common.refetchError)).toBeInTheDocument();
    expect(screen.getByText(progressLabel(12, 37))).toBeInTheDocument();
    expect(screen.queryByText(summaryError.title)).not.toBeInTheDocument();
  });
});
