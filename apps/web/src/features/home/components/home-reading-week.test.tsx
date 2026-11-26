import type { HomeReadingWeek as HomeReadingWeekData, HomeReadingWeekDay } from "@app/shared";
import type { ComponentProps } from "react";

import { describe, expect, it, vi } from "vitest";

import messages from "@/messages/uk.json";
import { renderWithProviders, screen, userEvent, within } from "@/test-utils";

import { HomeReadingWeek } from "./home-reading-week";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const week = messages.home.week;

const WEEK_DAYS: HomeReadingWeekDay[] = [
  { booksCount: 1, date: "2026-11-23", pagesRead: 30, status: "active" },
  { booksCount: 0, date: "2026-11-24", pagesRead: 0, status: "inactive" },
  { booksCount: null, date: "2026-11-25", pagesRead: null, status: "unknown" },
  { booksCount: null, date: "2026-11-26", pagesRead: null, status: "future" },
  { booksCount: null, date: "2026-11-27", pagesRead: null, status: "future" },
  { booksCount: null, date: "2026-11-28", pagesRead: null, status: "future" },
  { booksCount: null, date: "2026-11-29", pagesRead: null, status: "future" },
];

function readingWeek(overrides: Partial<HomeReadingWeekData> = {}): HomeReadingWeekData {
  return {
    activeDays: 1,
    currentStreak: {
      availability: "available",
      data: {
        continuesBeforeRange: true,
        continuesBeforeReliableHistory: false,
        days: 12,
        endDate: "2026-11-23",
        startDate: "2026-11-12",
      },
    },
    days: WEEK_DAYS,
    hasReadingHistory: true,
    pages: { quality: "exact", value: 120 },
    period: { from: "2026-11-23", to: "2026-11-29" },
    timezone: "Europe/Kyiv",
    today: "2026-11-25",
    weekStartDay: "monday",
    ...overrides,
  };
}

function showWeek(data: HomeReadingWeekData) {
  return renderWithProviders(
    <HomeReadingWeek isRetrying={false} onRetry={vi.fn()} widget={{ data, kind: "fresh" }} />,
  );
}

describe("HomeReadingWeek days", () => {
  it("renders exactly seven day cells", () => {
    showWeek(readingWeek());

    const days = screen.getByRole("list");
    expect(within(days).getAllByRole("listitem")).toHaveLength(7);
  });

  it("labels an active day with its status and reading preview", () => {
    showWeek(readingWeek());

    expect(
      screen.getByRole("link", { name: "23 листопада: було читання, 30 сторінок · 1 книга" }),
    ).toBeInTheDocument();
  });

  it("labels an inactive day", () => {
    showWeek(readingWeek());

    expect(screen.getByRole("link", { name: "24 листопада: без читання" })).toBeInTheDocument();
  });

  it("labels today with unknown data", () => {
    showWeek(readingWeek());

    expect(
      screen.getByRole("link", { name: "25 листопада: немає надійних даних, сьогодні" }),
    ).toBeInTheDocument();
  });

  it("labels a future day without making it a link", () => {
    showWeek(readingWeek());

    expect(screen.getByRole("img", { name: "26 листопада: ще попереду" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /26 листопада/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: /ще попереду/ })).toHaveLength(4);
  });

  it("links a past day to that day in the reading calendar", () => {
    showWeek(readingWeek());

    expect(screen.getByRole("link", { name: "24 листопада: без читання" })).toHaveAttribute(
      "href",
      "/reading-calendar?day=2026-11-24&month=2026-11&year=2026",
    );
  });

  it("links the header to the reading calendar", () => {
    showWeek(readingWeek());

    expect(screen.getByRole("link", { name: week.calendar })).toHaveAttribute(
      "href",
      "/reading-calendar",
    );
  });
});

describe("HomeReadingWeek summary", () => {
  it("shows the exact pages of the week", () => {
    showWeek(readingWeek({ pages: { quality: "exact", value: 120 } }));

    expect(screen.getByText("120 сторінок за тиждень")).toBeInTheDocument();
  });

  it("shows a lower bound when some pages are not counted", () => {
    showWeek(readingWeek({ pages: { quality: "lower_bound", value: 45 } }));

    expect(screen.getByText("Щонайменше 45 сторінок за тиждень")).toBeInTheDocument();
  });

  it("falls back to active days when pages are unavailable", () => {
    showWeek(readingWeek({ activeDays: 3, pages: { quality: "unavailable" } }));

    expect(screen.getByText("3 дні з читанням за тиждень")).toBeInTheDocument();
    expect(screen.queryByText(/сторін/)).not.toBeInTheDocument();
  });
});

describe("HomeReadingWeek streak", () => {
  it("shows the whole current streak even when it is longer than the week", () => {
    showWeek(readingWeek());

    expect(screen.getByText("12 днів поспіль")).toBeInTheDocument();
  });

  it("hides the streak when it is unavailable", () => {
    showWeek(readingWeek({ currentStreak: { availability: "unavailable", data: null } }));

    expect(screen.queryByText(/поспіль/)).not.toBeInTheDocument();
  });
});

describe("HomeReadingWeek states", () => {
  it("offers a retry when the week fails to load", async () => {
    const onRetry = vi.fn();
    renderWithProviders(
      <HomeReadingWeek isRetrying={false} onRetry={onRetry} widget={{ kind: "error" }} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(week.error.title);
    await userEvent.click(screen.getByRole("button", { name: week.error.retry }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
