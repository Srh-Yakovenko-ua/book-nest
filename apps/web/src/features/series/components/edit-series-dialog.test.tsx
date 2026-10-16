import "@testing-library/jest-dom/vitest";
import type { SeriesView } from "@app/shared";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeSeriesView } from "../model/series.fixtures";
import { EditSeriesDialog } from "./edit-series-dialog";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const copy = { edit: messages.series.editDialog, fields: messages.series.dialog };

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

function renderDialog(series: SeriesView) {
  renderWithProviders(<EditSeriesDialog onOpenChange={vi.fn()} open series={series} />);
}

function totalBooksInput() {
  return screen.getByLabelText(new RegExp(`^${copy.fields.totalBooks}`));
}

function updateBody() {
  const call = updateCall();
  if (call === undefined) throw new Error("no update request was sent");
  return JSON.parse(String(call[1]?.body)) as Record<string, unknown>;
}

function updateCall() {
  return fetchMock.mock.calls.find(
    ([input, init]) => String(input) === "/api/series/series-1" && init?.method === "PATCH",
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "PATCH" && url === "/api/series/series-1") {
      return Promise.resolve(jsonResponse(makeSeriesView()));
    }
    if (url.startsWith("/api/genres")) return Promise.resolve(jsonResponse([]));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("EditSeriesDialog total books", () => {
  it("keeps a cleared total empty and saves the series without a total", async () => {
    renderDialog(makeSeriesView({ id: "series-1", totalBooks: 8 }));
    expect(totalBooksInput()).toHaveValue(8);

    await userEvent.clear(totalBooksInput());
    expect(totalBooksInput()).toHaveDisplayValue("");

    await userEvent.click(screen.getByRole("button", { name: copy.edit.submit }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toMatchObject({ totalBooks: null });
  });

  it("saves a newly typed total", async () => {
    renderDialog(makeSeriesView({ id: "series-1", totalBooks: 8 }));

    await userEvent.clear(totalBooksInput());
    await userEvent.type(totalBooksInput(), "12");
    await userEvent.click(screen.getByRole("button", { name: copy.edit.submit }));

    await waitFor(() => expect(updateCall()).toBeDefined());
    expect(updateBody()).toMatchObject({ totalBooks: 12 });
  });
});
