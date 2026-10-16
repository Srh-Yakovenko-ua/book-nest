import type { ReactNode } from "react";

import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StatisticsControllerGetOverviewParams } from "@/shared/api/generated/model";

import { createTestQueryClient } from "@/test-utils";

import { overviewFixture } from "../model/statistics.fixtures";
import { useReadingStatisticsOverview } from "./use-reading-statistics-overview";

const fetchMock = vi.fn(() =>
  Promise.resolve(
    new Response(JSON.stringify(overviewFixture()), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    }),
  ),
);

const RANGES = {
  invalid: { from: "2026-05-31", period: "custom", to: "2026-03-01" },
  valid: { from: "2026-01-01", period: "custom", to: "2026-03-31" },
} satisfies Record<string, StatisticsControllerGetOverviewParams>;

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderOverview() {
  const queryClient = createTestQueryClient();

  return renderHook(
    ({ enabled, params }: { enabled: boolean; params: StatisticsControllerGetOverviewParams }) =>
      useReadingStatisticsOverview(params, { enabled }),
    {
      initialProps: { enabled: true, params: RANGES.valid },
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    },
  );
}

describe("useReadingStatisticsOverview", () => {
  it("does not keep the previous period on screen once the range becomes invalid", async () => {
    const { rerender, result } = renderOverview();

    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ enabled: false, params: RANGES.invalid });

    expect(result.current.data).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous period while a new valid range loads", async () => {
    const { rerender, result } = renderOverview();

    await waitFor(() => expect(result.current.data).toBeDefined());

    rerender({ enabled: true, params: { ...RANGES.valid, to: "2026-02-28" } });

    expect(result.current.data).toBeDefined();
    expect(result.current.isPlaceholderData).toBe(true);
  });
});
