import "@testing-library/jest-dom/vitest";
import { SeriesOrderPreferenceViewSchema } from "@app/shared";
import { afterEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { SeriesOrderCheckToggle } from "./series-order-check-toggle";

const copy = messages.series.details.orderCheck;
const SERIES_ID = "series-1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function mockPreferenceFetch(initialEnabled: boolean) {
  const state = { enabled: initialEnabled };
  const setPreference = vi.fn();

  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (!url.includes(`/api/series/${SERIES_ID}/order-check-preference`)) {
        return Promise.reject(new Error(`unexpected ${method} ${url}`));
      }
      if (method === "PUT") {
        const body = SeriesOrderPreferenceViewSchema.parse(JSON.parse(String(init?.body)));
        state.enabled = body.enabled;
        setPreference(body);
      }
      return Promise.resolve(jsonResponse(state));
    }),
  );

  return { setPreference };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SeriesOrderCheckToggle", () => {
  it("shows the switch on when order checking is enabled", async () => {
    mockPreferenceFetch(true);

    renderWithProviders(<SeriesOrderCheckToggle seriesId={SERIES_ID} />);

    expect(await screen.findByRole("switch", { name: copy.label })).toBeChecked();
  });

  it("shows the switch off when order checking is disabled", async () => {
    mockPreferenceFetch(false);

    renderWithProviders(<SeriesOrderCheckToggle seriesId={SERIES_ID} />);

    expect(await screen.findByRole("switch", { name: copy.label })).not.toBeChecked();
  });

  it("sends the flipped preference and reflects it when toggled off", async () => {
    const { setPreference } = mockPreferenceFetch(true);

    renderWithProviders(<SeriesOrderCheckToggle seriesId={SERIES_ID} />);

    const toggle = await screen.findByRole("switch", { name: copy.label });
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);

    await waitFor(() => expect(setPreference).toHaveBeenCalledWith({ enabled: false }));
    await waitFor(() => expect(screen.getByRole("switch", { name: copy.label })).not.toBeChecked());
  });
});
