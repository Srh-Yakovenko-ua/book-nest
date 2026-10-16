import "@testing-library/jest-dom/vitest";
import { defaultUserProfileSettings } from "@app/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { BookDateField } from "./book-date-field";

const TODAY = new Date(2026, 7, 15, 9, 0, 0);

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
});

afterAll(() => {
  vi.useRealTimers();
});

beforeEach(() => {
  vi.setSystemTime(TODAY);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes("/api/profile/settings")) {
      return Promise.resolve(
        new Response(JSON.stringify(defaultUserProfileSettings), {
          headers: { "Content-Type": "application/json" },
          status: 200,
        }),
      );
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("BookDateField", () => {
  it("reports null when the selected day is clicked again", async () => {
    const onChange = vi.fn();
    renderWithProviders(
      <BookDateField
        ariaLabel="Дата покупки"
        id="purchase-date"
        onChange={onChange}
        value="2026-08-12"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /^Дата покупки/ }));
    const selectedDay = screen.getByRole("gridcell", { selected: true });
    expect(selectedDay).toHaveTextContent("12");

    await userEvent.click(within(selectedDay).getByRole("button"));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
