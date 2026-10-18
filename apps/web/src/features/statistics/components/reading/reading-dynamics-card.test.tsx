import type { ReadingStatisticsBucket } from "@app/shared";
import type { ReactNode } from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { overviewFixture } from "../../model/statistics.fixtures";
import { ReadingDynamicsCard } from "./reading-dynamics-card";

const text = messages.statistics;

const overview = overviewFixture();

function monthBucket(month: string, pagesRead: number): ReadingStatisticsBucket {
  return {
    completedReads: 1,
    drilldown: {
      filters: { finishedFrom: `2026-${month}-01`, finishedTo: `2026-${month}-28` },
      kind: "completed_reads_subset",
      period: { from: "2026-01-01", to: "2026-03-31" },
    },
    end: `2026-${month}-28`,
    pagesRead,
    start: `2026-${month}-01`,
    uniqueBooksCompleted: 1,
  };
}

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname === "/api/statistics/reading-activity") {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          activeDays: 1,
          booksCount: 0,
          historyQuality: "exact",
          items: [],
          nextCursor: null,
          pagesRead: 0,
          range: { from: url.searchParams.get("from"), to: url.searchParams.get("to") },
          reliableFrom: "2026-01-01",
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );
  }
  return Promise.reject(new Error(`unexpected fetch ${url.pathname}`));
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ReadingDynamicsCard bucket selection", () => {
  it("walks the buckets with the arrow keys, opens one with Enter and returns focus on close", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ReadingDynamicsCard
        comparison={null}
        dynamics={{
          ...overview.dynamics,
          buckets: [monthBucket("01", 10), monthBucket("02", 20), monthBucket("03", 30)],
        }}
        isComparisonLowerBound={false}
        metric="pages"
        onMetricChange={vi.fn()}
        period={overview.period}
        variant="full"
      />,
    );
    const buckets = screen.getAllByRole("button", { name: /сторінок/ });

    for (let step = 0; step < 4 && document.activeElement !== buckets[0]; step += 1) {
      await user.tab();
    }
    expect(buckets[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}");
    expect(buckets[1]).toHaveFocus();
    expect(buckets[0]).toHaveAttribute("tabindex", "-1");

    await user.keyboard("{Enter}");

    const heading = await screen.findByRole("heading", { name: /^Сторінки: / });
    expect(heading).toHaveFocus();
    expect(buckets[1]).toHaveAttribute("aria-expanded", "true");
    expect(new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost").search).toBe(
      "?from=2026-02-01&to=2026-02-28",
    );

    await user.click(screen.getByRole("button", { name: text.details.bucket.close }));

    expect(screen.queryByRole("heading", { name: /^Сторінки: / })).toBeNull();
    expect(buckets[1]).toHaveFocus();
  });
});
