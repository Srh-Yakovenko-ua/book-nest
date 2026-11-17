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
    const { queryClient } = renderWithProviders(
      <NuqsTestingAdapter>
        <SeriesDetails id={SERIES_ID} />
      </NuqsTestingAdapter>,
    );
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
    renderWithProviders(
      <NuqsTestingAdapter>
        <SeriesDetails id={SERIES_ID} />
      </NuqsTestingAdapter>,
    );
    await screen.findByRole("heading", { name: states.errorTitle });

    detailStatus = 200;
    await userEvent.click(screen.getByRole("button", { name: common.retry }));

    expect(await screen.findByRole("heading", { level: 1, name: SERIES_NAME })).toHaveFocus();
  });
});
