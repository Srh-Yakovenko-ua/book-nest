import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeSeriesView } from "../model/series.fixtures";
import { CreateSeriesDialog } from "./create-series-dialog";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const copy = messages.series.dialog;

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function createCall() {
  return fetchMock.mock.calls.find(
    ([input, init]) => String(input) === "/api/series" && init?.method === "POST",
  );
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST" && url === "/api/series") {
      return Promise.resolve(jsonResponse(makeSeriesView()));
    }
    if (url.startsWith("/api/genres")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/api/authors/recent")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/api/authors")) {
      return Promise.resolve(
        jsonResponse({ items: [], page: 1, pagesCount: 0, pageSize: 20, totalCount: 0 }),
      );
    }
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("CreateSeriesDialog total books", () => {
  it("leaves total books out of the create body once the typed count is cleared", async () => {
    renderWithProviders(<CreateSeriesDialog onOpenChange={vi.fn()} open />);
    const totalBooksInput = screen.getByLabelText(new RegExp(`^${copy.totalBooks}`));

    await userEvent.type(screen.getByLabelText(copy.name), "Відьмак");
    await userEvent.type(totalBooksInput, "5");
    await userEvent.clear(totalBooksInput);
    expect(totalBooksInput).toHaveDisplayValue("");

    await userEvent.click(screen.getByRole("button", { name: copy.submit }));

    await waitFor(() => expect(createCall()).toBeDefined());
    const body = JSON.parse(String(createCall()?.[1]?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({ name: "Відьмак" });
    expect(body).not.toHaveProperty("totalBooks");
  });
});
