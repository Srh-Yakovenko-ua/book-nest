import type { ReactNode } from "react";

import { defaultUserProfileSettings } from "@app/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, waitFor } from "@/test-utils";

import { useReadingCalendarParams } from "./use-reading-calendar-params";

const CLOCK = { now: new Date("2026-03-20T12:00:00Z"), today: "2026-03-20" } as const;

const fetchMock = vi.fn((input: RequestInfo | URL) => {
  const url = new URL(String(input), "http://localhost");
  if (url.pathname.endsWith("/api/profile/settings")) {
    return Promise.resolve(
      new Response(JSON.stringify(defaultUserProfileSettings), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
    );
  }
  return Promise.reject(new Error(`unexpected fetch ${url.href}`));
});

beforeEach(() => {
  vi.useFakeTimers({ now: CLOCK.now, toFake: ["Date"] });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function renderParams(searchParams: string, { resetUrlUpdateQueueOnMount = true } = {}) {
  const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
  const queryClient = createTestQueryClient();
  const { result } = renderHook(() => useReadingCalendarParams(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <NuqsTestingAdapter
          hasMemory
          onUrlUpdate={onUrlUpdate}
          resetUrlUpdateQueueOnMount={resetUrlUpdateQueueOnMount}
          searchParams={searchParams}
        >
          {children}
        </NuqsTestingAdapter>
      </QueryClientProvider>
    ),
  });
  return { onUrlUpdate, result };
}

describe("useReadingCalendarParams", () => {
  it.each([
    { day: "2026-03-40", reason: "an impossible date" },
    { day: "abc", reason: "text that is no date" },
    { day: "2026-02-10", reason: "a day of another month" },
    { day: "2026-03-21", reason: "a day after today" },
  ])("drops $reason as the day with a replace, keeping the month and the year", async ({ day }) => {
    const { onUrlUpdate, result } = renderParams(`?year=2026&month=2026-03&day=${day}`, {
      resetUrlUpdateQueueOnMount: false,
    });

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const update = onUrlUpdate.mock.calls.at(-1)?.[0];
    expect(update?.searchParams.toString()).toBe("year=2026&month=2026-03");
    expect(update?.options.history).toBe("replace");
    expect(result.current.day).toBeNull();
    expect(result.current.month).toBe("2026-03");
  });

  it.each(["2026-03-01", CLOCK.today])("returns the valid day %s as the day", (day) => {
    const { result } = renderParams(`?year=2026&month=2026-03&day=${day}`);

    expect(result.current.day).toBe(day);
  });

  it("writes a day of the shown month in one replace", async () => {
    const { onUrlUpdate, result } = renderParams("?year=2026&month=2026-03");

    act(() => result.current.selectDay("2026-03-05"));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledTimes(1));
    const update = onUrlUpdate.mock.calls[0]?.[0];
    expect(update?.searchParams.get("day")).toBe("2026-03-05");
    expect(update?.searchParams.get("month")).toBe("2026-03");
    expect(update?.options.history).toBe("replace");
    expect(result.current.day).toBe("2026-03-05");
  });

  it("writes a day of another month together with that month in one push", async () => {
    const { onUrlUpdate, result } = renderParams("?year=2026&month=2026-03");

    act(() => result.current.selectDay("2026-02-10"));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalledTimes(1));
    const update = onUrlUpdate.mock.calls[0]?.[0];
    expect(update?.searchParams.get("day")).toBe("2026-02-10");
    expect(update?.searchParams.get("month")).toBe("2026-02");
    expect(update?.searchParams.get("year")).toBe("2026");
    expect(update?.options.history).toBe("push");
    expect(result.current.day).toBe("2026-02-10");
    expect(result.current.month).toBe("2026-02");
  });

  it("removes the day in the same update that changes the month", async () => {
    const { onUrlUpdate, result } = renderParams("?year=2026&month=2026-03&day=2026-03-05");

    act(() => result.current.setMonth("2026-02"));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const update = onUrlUpdate.mock.calls[0]?.[0];
    expect(update?.searchParams.get("month")).toBe("2026-02");
    expect(update?.searchParams.has("day")).toBe(false);
    expect(update?.options.history).toBe("push");
  });

  it("removes the month and the day in the same update that changes the year", async () => {
    const { onUrlUpdate, result } = renderParams("?year=2026&month=2026-03&day=2026-03-05");

    act(() => result.current.setYear(2025));

    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const update = onUrlUpdate.mock.calls[0]?.[0];
    expect(update?.searchParams.toString()).toBe("year=2025");
    expect(update?.options.history).toBe("push");
  });
});
