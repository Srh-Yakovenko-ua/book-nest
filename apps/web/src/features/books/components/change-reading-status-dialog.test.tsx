import { defaultUserProfileSettings } from "@app/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { ChangeReadingStatusDialog } from "./change-reading-status-dialog";

const reading = messages.books.details.reading;
const statusOptions = messages.books.readingStatus.options;
const SERVER_MESSAGE = "Reading status transition is not allowed";

const book = makeBookView({
  pagesCount: 540,
  readingProgress: {
    abandonedAt: null,
    currentPage: 220,
    finishedAt: null,
    impression: null,
    lastProgressUpdateAt: "2026-01-25",
    note: null,
    pausedAt: null,
    rating: null,
    startedAt: "2026-01-20",
  },
  readingStatus: "reading",
});

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(jsonResponse(defaultUserProfileSettings));
    if (url.includes(`/api/books/${book.id}/reading-status`) && method === "POST")
      return Promise.resolve(jsonResponse({ message: SERVER_MESSAGE }, 422));
    return Promise.reject(new Error(`unexpected ${method} ${url}`));
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ChangeReadingStatusDialog server errors", () => {
  it("shows the translated save error instead of the server text when the change is rejected", async () => {
    renderWithProviders(<ChangeReadingStatusDialog book={book} onOpenChange={vi.fn()} open />);

    await userEvent.click(screen.getByRole("radio", { name: statusOptions.paused }));
    await userEvent.click(screen.getByRole("button", { name: reading.statusDialog.submit }));

    expect(await screen.findByText(reading.errors.generic)).toBeInTheDocument();
    expect(screen.queryByText(SERVER_MESSAGE)).not.toBeInTheDocument();
  });
});
