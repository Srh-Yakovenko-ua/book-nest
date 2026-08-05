import "@testing-library/jest-dom/vitest";

import type { SettingsView } from "@app/shared";

import { defaultUserProfileSettings } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, waitFor } from "@/test-utils";

import { useWeekStartsOn } from "./use-week-starts-on";

const fetchMock = vi.fn();

let respondToSettings: () => Response;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function settingsView(overrides: Partial<SettingsView> = {}): SettingsView {
  return { ...defaultUserProfileSettings, ...overrides };
}

function WeekStartsOnProbe() {
  return <span data-testid="week-starts-on">{useWeekStartsOn()}</span>;
}

beforeEach(() => {
  respondToSettings = () => jsonResponse(settingsView());
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/profile/settings")) return Promise.resolve(respondToSettings());
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("useWeekStartsOn", () => {
  it("maps the stored monday preference to the date-fns Monday index", async () => {
    respondToSettings = () => jsonResponse(settingsView({ weekStartDay: "monday" }));

    renderWithProviders(<WeekStartsOnProbe />);

    await waitFor(() => expect(screen.getByTestId("week-starts-on")).toHaveTextContent("1"));
  });

  it("maps the stored sunday preference to the date-fns Sunday index", async () => {
    respondToSettings = () => jsonResponse(settingsView({ weekStartDay: "sunday" }));

    renderWithProviders(<WeekStartsOnProbe />);

    await waitFor(() => expect(screen.getByTestId("week-starts-on")).toHaveTextContent("0"));
  });

  it("falls back to the shared default while the settings query is still loading", () => {
    renderWithProviders(<WeekStartsOnProbe />);

    expect(screen.getByTestId("week-starts-on")).toHaveTextContent("1");
  });

  it("falls back to the shared default when the settings query fails", async () => {
    respondToSettings = () => jsonResponse({ message: "boom" }, 500);

    renderWithProviders(<WeekStartsOnProbe />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.getByTestId("week-starts-on")).toHaveTextContent("1");
  });
});
