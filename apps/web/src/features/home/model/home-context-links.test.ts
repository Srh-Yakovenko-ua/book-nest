import type { HomeAttentionGroup } from "@app/shared";

import { describe, expect, it } from "vitest";

import { homeAttentionHref, readingCalendarDayHref } from "./home-context-links";

const IDS = {
  book: "4b2e7d1c-8a3f-4c6e-9d5b-0e1f2a3b4c5d",
  goal: "7c3f8e2d-9b4a-4d7f-ae6c-1f2a3b4c5d6e",
  order: "8d4a9f3e-ac5b-4e8a-bf7d-2a3b4c5d6e7f",
  series: "9e5bae4f-bd6c-4f9b-8a8e-3b4c5d6e7f8a",
} as const;

const GROUP_BASE = {
  count: 2,
  dueDate: null,
  id: "attention-group",
  severity: "high",
  unit: "books",
} as const;

const ATTENTION_HREFS: readonly (readonly [string, HomeAttentionGroup, string])[] = [
  [
    "a parcel awaiting dispatch",
    { ...GROUP_BASE, maxWaitingDays: 5, reason: "delivery_awaiting_dispatch" },
    "/delivery/in-transit?filter=awaiting_dispatch",
  ],
  [
    "a delayed parcel",
    { ...GROUP_BASE, maxDelayDays: 3, reason: "delivery_delayed" },
    "/delivery/in-transit?filter=delayed",
  ],
  [
    "an expiring pickup",
    { ...GROUP_BASE, expiredCount: 1, reason: "delivery_pickup_expiring" },
    "/delivery/in-transit?filter=pickup_expiring",
  ],
  [
    "a parcel ready for pickup",
    { ...GROUP_BASE, reason: "delivery_ready_for_pickup" },
    "/delivery/in-transit?filter=ready_for_pickup",
  ],
  [
    "unassigned books with an order to reveal",
    {
      ...GROUP_BASE,
      ordersCount: 1,
      reason: "delivery_unassigned_books",
      revealOrderId: IDS.order,
    },
    `/delivery/in-transit?filter=unassigned&orderId=${IDS.order}`,
  ],
  [
    "unassigned books across several orders",
    { ...GROUP_BASE, ordersCount: 3, reason: "delivery_unassigned_books", revealOrderId: null },
    "/delivery/in-transit?filter=unassigned",
  ],
  [
    "an overdue borrowed book",
    { ...GROUP_BASE, direction: "borrowed_from_someone", reason: "loan_overdue" },
    "/loans/borrowed?filter=overdue",
  ],
  [
    "an overdue lent book",
    { ...GROUP_BASE, direction: "lent_to_someone", reason: "loan_overdue" },
    "/loans/lent?filter=overdue",
  ],
  [
    "a borrowed book to return soon",
    { ...GROUP_BASE, direction: "borrowed_from_someone", reason: "loan_return_soon" },
    "/loans/borrowed?filter=return_soon",
  ],
  [
    "a lent book coming back soon",
    { ...GROUP_BASE, direction: "lent_to_someone", reason: "loan_return_soon" },
    "/loans/lent?filter=return_soon",
  ],
  [
    "a goal at risk",
    {
      ...GROUP_BASE,
      goalId: IDS.goal,
      goalName: "50 книжок",
      isPrimary: true,
      listName: null,
      reason: "goal_at_risk",
      riskReason: "behind_schedule",
    },
    `/goals/${IDS.goal}`,
  ],
  [
    "one stale book",
    { ...GROUP_BASE, bookId: IDS.book, bookTitle: "Дюна", reason: "reading_stale" },
    `/books/${IDS.book}`,
  ],
  [
    "several stale books",
    { ...GROUP_BASE, bookId: null, bookTitle: null, reason: "reading_stale" },
    "/books?status=reading,rereading",
  ],
  [
    "one series out of order",
    {
      ...GROUP_BASE,
      reason: "series_order_issue",
      seriesId: IDS.series,
      seriesTitle: "Дюна",
    },
    `/series/${IDS.series}`,
  ],
  [
    "several series out of order",
    { ...GROUP_BASE, reason: "series_order_issue", seriesId: null, seriesTitle: null },
    "/reading-queue",
  ],
  [
    "one queued book near its deadline",
    {
      ...GROUP_BASE,
      bookId: IDS.book,
      bookTitle: "Дюна",
      queueReasons: ["book_club"],
      reason: "queue_deadline",
    },
    `/books/${IDS.book}`,
  ],
  [
    "several queued books near their deadline",
    {
      ...GROUP_BASE,
      bookId: null,
      bookTitle: null,
      queueReasons: ["book_club", "buddy_read"],
      reason: "queue_deadline",
    },
    "/reading-queue",
  ],
];

describe("homeAttentionHref", () => {
  it.each(ATTENTION_HREFS)("links %s to the place where it is resolved", (_label, group, href) => {
    expect(homeAttentionHref(group)).toBe(href);
  });
});

describe("readingCalendarDayHref", () => {
  it("opens the calendar on the day with its month and year", () => {
    expect(readingCalendarDayHref("2026-11-24")).toBe(
      "/reading-calendar?day=2026-11-24&month=2026-11&year=2026",
    );
  });

  it("opens the next month for the first day after a month end", () => {
    expect(readingCalendarDayHref("2026-12-01")).toBe(
      "/reading-calendar?day=2026-12-01&month=2026-12&year=2026",
    );
  });

  it("keeps the old year on the last day of December", () => {
    expect(readingCalendarDayHref("2026-12-31")).toBe(
      "/reading-calendar?day=2026-12-31&month=2026-12&year=2026",
    );
  });

  it("opens the next year on the first day of January", () => {
    expect(readingCalendarDayHref("2027-01-01")).toBe(
      "/reading-calendar?day=2027-01-01&month=2027-01&year=2027",
    );
  });
});
