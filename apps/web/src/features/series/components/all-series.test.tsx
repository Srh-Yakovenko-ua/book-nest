import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { seriesKeys } from "../api/series-keys";
import { makeSeriesOverview, makeSeriesView } from "../model/series.fixtures";
import { AllSeries } from "./all-series";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const common = messages.common;
const seriesStates = messages.series.states;
const resultsTitle = messages.series.page.resultsTitle;

const SERIES_LIST = { pagesCount: 3, pageSize: 100 } as const;

type SeriesPageRequest = { attempt: number; pageNumber: number };

const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();
const requestedPages: number[] = [];

let replyToSeriesPage: (request: SeriesPageRequest) => Promise<Response>;

beforeEach(() => {
  requestedPages.length = 0;
  replyToSeriesPage = seriesPage;
  fetchMock.mockReset();
  fetchMock.mockImplementation(reply);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AllSeries auto paging", () => {
  it("loads every page without user action", async () => {
    renderAllSeries();

    expect(
      await screen.findByRole("heading", { level: 3, name: seriesName(3) }),
    ).toBeInTheDocument();
    expect(requestedPages).toEqual([1, 2, 3]);
  });
});

describe("AllSeries next page failure", () => {
  it("keeps the first page and shows the refresh banner instead of the error card", async () => {
    replyToSeriesPage = failSecondPage;
    renderAllSeries();

    expect(await screen.findByText(common.refetchError)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: common.retry })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: seriesName(1) })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: seriesStates.error.title }),
    ).not.toBeInTheDocument();
  });

  it("asks for the failed page only once", async () => {
    replyToSeriesPage = failSecondPage;
    renderAllSeries();
    await screen.findByText(common.refetchError);

    await act(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, 100);
        }),
    );

    expect(pageRequests(2)).toBe(1);
  });

  it("loads the remaining pages and hides the banner when its retry succeeds", async () => {
    replyToSeriesPage = (request) =>
      request.pageNumber === 2 && request.attempt === 1 ? serverError() : seriesPage(request);
    renderAllSeries();

    await userEvent.click(await screen.findByRole("button", { name: common.retry }));

    expect(
      await screen.findByRole("heading", { level: 3, name: seriesName(3) }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: seriesName(2) })).toBeInTheDocument();
    expect(pageRequests(2)).toBe(2);
    expect(screen.queryByText(common.refetchError)).not.toBeInTheDocument();
  });
});

describe("AllSeries background refetch failure", () => {
  it("keeps the loaded series and shows the refresh banner instead of the error card", async () => {
    const { queryClient } = renderAllSeries();
    expect(
      await screen.findByRole("heading", { level: 3, name: seriesName(3) }),
    ).toBeInTheDocument();

    replyToSeriesPage = serverError;
    await act(() => queryClient.invalidateQueries({ queryKey: [...seriesKeys.root, "list"] }));

    expect(await screen.findByText(common.refetchError)).toBeInTheDocument();
    expect(pageRequests(1)).toBe(2);
    expect(screen.getByRole("heading", { level: 3, name: seriesName(1) })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: seriesStates.error.title }),
    ).not.toBeInTheDocument();
  });
});

describe("AllSeries first load failure", () => {
  it("shows the error card with a retry and no refresh banner", async () => {
    replyToSeriesPage = serverError;
    renderAllSeries();

    expect(
      await screen.findByRole("heading", { name: seriesStates.error.title }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: seriesStates.error.retry })).toBeInTheDocument();
    expect(screen.queryByText(common.refetchError)).not.toBeInTheDocument();
  });

  it("moves focus to the new retry button when the retried first load fails again", async () => {
    let failRetry = () => {};
    const retryFailure = new Promise<Response>((resolve) => {
      failRetry = () => resolve(serverError());
    });
    replyToSeriesPage = (request) => (request.attempt === 1 ? serverError() : retryFailure);
    renderAllSeries();
    (await screen.findByRole("button", { name: seriesStates.error.retry })).focus();

    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: seriesStates.error.retry }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: resultsTitle })).toHaveFocus();
    failRetry();

    expect(await screen.findByRole("button", { name: seriesStates.error.retry })).toHaveFocus();
    expect(pageRequests(1)).toBe(2);
  });
});

function failSecondPage(request: SeriesPageRequest): Promise<Response> {
  return request.pageNumber === 2 ? serverError() : seriesPage(request);
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function pageRequests(pageNumber: number): number {
  return requestedPages.filter((requested) => requested === pageNumber).length;
}

function renderAllSeries() {
  return renderWithProviders(
    <NuqsTestingAdapter>
      <AllSeries />
    </NuqsTestingAdapter>,
  );
}

function reply(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname === "/api/series") {
    const pageNumber = Number(url.searchParams.get("pageNumber"));
    requestedPages.push(pageNumber);
    return replyToSeriesPage({ attempt: pageRequests(pageNumber), pageNumber });
  }
  if (url.pathname === "/api/series/overview") return json(makeSeriesOverview());
  if (url.pathname === "/api/genres") return json([]);
  if (url.pathname === "/api/books/facets") return json({ authors: [], genres: [] });
  return Promise.reject(new Error(`unexpected fetch: ${url.pathname}`));
}

function seriesName(pageNumber: number): string {
  return `Saga from page ${pageNumber}`;
}

function seriesPage({ pageNumber }: SeriesPageRequest): Promise<Response> {
  return json({
    items: [
      makeSeriesView({ covers: [], id: `series-${pageNumber}`, name: seriesName(pageNumber) }),
    ],
    page: pageNumber,
    pagesCount: SERIES_LIST.pagesCount,
    pageSize: SERIES_LIST.pageSize,
    totalCount: SERIES_LIST.pagesCount,
  });
}

function serverError(): Promise<Response> {
  return json({ message: "boom" }, 500);
}
