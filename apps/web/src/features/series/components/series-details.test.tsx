import type { ReactNode } from "react";

import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { seriesKeys } from "../api/series-keys";
import { makeSeriesDetailsView } from "../model/series.fixtures";
import { SeriesDetails } from "./series-details";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const SERIES_ID = "series-1";
const SERIES_NAME = "Емпіреї";

const common = messages.common;
const states = messages.series.details.states;

const ILLUSTRATION = {
  error: "error-generic.png",
  notFound: "error-not-found.png",
} as const;

const fetchMock = vi.fn<(input: RequestInfo | URL) => Promise<Response>>();

let detailStatus: number;

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
      status,
    }),
  );
}

function renderSeriesDetails() {
  return renderWithProviders(
    <NuqsTestingAdapter>
      <SeriesDetails id={SERIES_ID} />
    </NuqsTestingAdapter>,
  );
}

function reply(input: RequestInfo | URL): Promise<Response> {
  const { pathname } = new URL(String(input), "http://localhost");
  if (pathname === `/api/series/${SERIES_ID}`) {
    if (detailStatus !== 200) return json({ message: "boom" }, detailStatus);
    return json(makeSeriesDetailsView({ id: SERIES_ID, name: SERIES_NAME }));
  }
  if (pathname.startsWith("/api/genres")) return json([]);
  return json({});
}

beforeEach(() => {
  detailStatus = 200;
  fetchMock.mockReset();
  fetchMock.mockImplementation(reply);
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("SeriesDetails", () => {
  it("keeps the loaded series and shows the refresh banner when a refetch fails", async () => {
    const { queryClient } = renderSeriesDetails();
    await screen.findByRole("heading", { level: 1, name: SERIES_NAME });

    detailStatus = 500;
    await act(() =>
      queryClient.invalidateQueries({ exact: true, queryKey: seriesKeys.detail(SERIES_ID) }),
    );

    expect(await screen.findByText(common.refetchError)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: SERIES_NAME })).toBeInTheDocument();
  });

  it("moves focus to the series title when a retried first load succeeds", async () => {
    detailStatus = 500;
    renderSeriesDetails();
    await screen.findByRole("heading", { name: states.errorTitle });

    detailStatus = 200;
    await userEvent.click(screen.getByRole("button", { name: common.retry }));

    expect(await screen.findByRole("heading", { level: 1, name: SERIES_NAME })).toHaveFocus();
  });
});

describe("SeriesDetails illustrations", () => {
  it("shows the not-found art when the first load returns 404", async () => {
    detailStatus = 404;
    renderSeriesDetails();

    await screen.findByRole("heading", { name: states.notFoundTitle });
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(ILLUSTRATION.notFound),
    );
  });

  it("shows the generic error art when the first load fails", async () => {
    detailStatus = 500;
    renderSeriesDetails();

    await screen.findByRole("heading", { name: states.errorTitle });
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      expect.stringContaining(ILLUSTRATION.error),
    );
  });
});
