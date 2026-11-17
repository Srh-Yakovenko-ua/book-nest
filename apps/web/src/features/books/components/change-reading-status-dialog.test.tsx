import { defaultUserProfileSettings } from "@app/shared";
import { parseISO } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, waitFor } from "@/test-utils";

import { makeBookView } from "./book-details.fixtures";
import { ChangeReadingStatusDialog } from "./change-reading-status-dialog";

const reading = messages.books.details.reading;
const statusOptions = messages.books.readingStatus.options;
const SERVER_MESSAGE = "Reading status transition is not allowed";
const KYIV_AFTER_MIDNIGHT = parseISO("2026-11-15T22:30:00Z");

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

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

let profileTimeZone: string = defaultUserProfileSettings.timezone;

function dateTriggerName(day: string) {
  return `${reading.statusDialog.date}, ${day}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

function statusPayload(): unknown {
  const call = fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).includes(`/api/books/${book.id}/reading-status`) &&
      (init?.method ?? "GET").toUpperCase() === "POST",
  );
  return call === undefined ? undefined : JSON.parse(String(call[1]?.body));
}

beforeEach(() => {
  profileTimeZone = defaultUserProfileSettings.timezone;
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/api/profile/settings"))
      return Promise.resolve(
        jsonResponse({ ...defaultUserProfileSettings, timezone: profileTimeZone }),
      );
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

describe("ChangeReadingStatusDialog date in the profile time zone", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(KYIV_AFTER_MIDNIGHT);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves the Kyiv day 2026-11-16 while UTC is still on the 15th", async () => {
    profileTimeZone = "Europe/Kyiv";
    renderWithProviders(<ChangeReadingStatusDialog book={book} onOpenChange={vi.fn()} open />);

    await userEvent.click(screen.getByRole("radio", { name: statusOptions.paused }));
    expect(
      await screen.findByRole("button", { name: dateTriggerName("16 листопада 2026") }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: reading.statusDialog.submit }));

    await waitFor(() => expect(statusPayload()).toMatchObject({ date: "2026-11-16" }));
    expect(screen.queryByText(reading.errors.dateFuture)).not.toBeInTheDocument();
  });

  it("keeps 2026-11-16 out of reach for a UTC profile at the same instant", async () => {
    profileTimeZone = "UTC";
    renderWithProviders(<ChangeReadingStatusDialog book={book} onOpenChange={vi.fn()} open />);

    await userEvent.click(screen.getByRole("radio", { name: statusOptions.paused }));
    await userEvent.click(
      await screen.findByRole("button", { name: dateTriggerName("15 листопада 2026") }),
    );

    expect(await screen.findByRole("button", { name: /16-е листопада 2026/ })).toBeDisabled();
  });
});
