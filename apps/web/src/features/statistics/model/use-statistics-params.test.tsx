import type { SettingsView } from "@app/shared";
import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test-utils";

import { useStatisticsParams } from "./use-statistics-params";

let currentSearchParams = new URLSearchParams();

let settings: SettingsView = defaultUserProfileSettings;

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes("/api/profile/settings")) {
    return Promise.resolve(
      new Response(JSON.stringify(settings), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
  }
  return Promise.reject(new Error(`unexpected ${url}`));
});

beforeEach(() => {
  settings = defaultUserProfileSettings;
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => currentSearchParams,
}));

function renderParams(searchParams = "") {
  currentSearchParams = new URLSearchParams(searchParams);

  const queryClient = createTestQueryClient();

  return renderHook(() => useStatisticsParams(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter hasMemory searchParams={searchParams}>
          {children}
        </NuqsTestingAdapter>
      </QueryClientProvider>
    ),
  });
}

describe("useStatisticsParams", () => {
  it("opens on the current calendar year with the comparison off", () => {
    const { result } = renderParams();

    expect(result.current.state.period).toBe("year");
    expect(result.current.compareMode).toBeNull();
    expect(result.current.canCompare).toBe(true);
    expect(result.current.isRequestable).toBe(true);
  });

  it("dates today in the profile time zone, not the device one", async () => {
    vi.useFakeTimers({ now: new Date("2026-12-31T23:30:00.000Z"), toFake: ["Date"] });
    settings = { ...defaultUserProfileSettings, timezone: "America/New_York" };

    const { result } = renderParams();

    await waitFor(() => expect(result.current.today).toBe("2026-12-31"));
    expect(result.current.queryParams).toEqual({ period: "year", year: 2026 });
  });

  it("refuses a custom range longer than 1830 days", async () => {
    const { result } = renderParams("?period=custom&from=2020-01-01&to=2025-12-31");

    await waitFor(() => expect(result.current.state.period).toBe("custom"));
    expect(result.current.rangeIssue).toBe("tooLong");
    expect(result.current.isRequestable).toBe(false);
  });

  it("cannot compare all time", async () => {
    const { result } = renderParams("?period=all_time&compare=previous_period");

    await waitFor(() => expect(result.current.state.period).toBe("all_time"));
    expect(result.current.canCompare).toBe(false);
    expect(result.current.compareMode).toBeNull();
    expect(result.current.queryParams).not.toHaveProperty("compare");
  });

  it("turns the comparison off when the reader moves to all time", async () => {
    const { result } = renderParams("?period=year&compare=same_period_last_year");

    result.current.setPeriod("all_time");

    await waitFor(() => expect(result.current.state.period).toBe("all_time"));
    expect(result.current.state.compare).toBeNull();
  });

  it("keeps a custom range in the url and requests it", async () => {
    const { result } = renderParams();

    result.current.setCustomRange({ from: "2026-01-05", to: "2026-02-05" });

    await waitFor(() => expect(result.current.state.period).toBe("custom"));
    expect(result.current.queryParams).toMatchObject({
      from: "2026-01-05",
      period: "custom",
      to: "2026-02-05",
    });
  });

  it("refuses to request a reversed custom range instead of swapping it", async () => {
    const { result } = renderParams("?period=custom&from=2026-05-31&to=2026-03-01");

    await waitFor(() => expect(result.current.state.period).toBe("custom"));
    expect(result.current.rangeIssue).toBe("reversed");
    expect(result.current.isRequestable).toBe(false);
    expect(result.current.state.from).toBe("2026-05-31");
    expect(result.current.state.to).toBe("2026-03-01");
  });

  it("clears a leftover custom range when another period takes over", async () => {
    const { result } = renderParams("?period=custom&from=2026-03-01&to=2026-05-31");

    result.current.setPeriod("last_12_months");

    await waitFor(() => expect(result.current.state.period).toBe("last_12_months"));
    expect(result.current.state.from).toBe("");
    expect(result.current.state.to).toBe("");
  });

  it("moves to a picked calendar year", async () => {
    const { result } = renderParams("?period=all_time");

    result.current.setYear(2024);

    await waitFor(() => expect(result.current.state.period).toBe("year"));
    expect(result.current.queryParams).toMatchObject({ period: "year", year: 2024 });
  });
});
