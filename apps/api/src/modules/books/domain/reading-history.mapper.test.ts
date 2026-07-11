import { describe, expect, it } from "vitest";

import { toReadingHistoryView } from "./reading-history.mapper.js";

const DAY_ONE = new Date("2026-07-05T00:00:00.000Z");
const DAY_TWO = new Date("2026-07-06T00:00:00.000Z");

const eventsAcrossTwoDays = [
  { date: DAY_ONE, id: "e1", page: 40, pagesRead: 40 },
  { date: DAY_ONE, id: "e2", page: 90, pagesRead: 50 },
  { date: DAY_TWO, id: "e3", page: 150, pagesRead: 60 },
];

describe("toReadingHistoryView", () => {
  it("sums the pages read per calendar day into daily buckets", () => {
    const view = toReadingHistoryView({ events: eventsAcrossTwoDays });

    expect(view.daily).toEqual([
      { date: "2026-07-05", pagesRead: 90 },
      { date: "2026-07-06", pagesRead: 60 },
    ]);
  });

  it("counts each distinct calendar day once in daysRead", () => {
    const view = toReadingHistoryView({ events: eventsAcrossTwoDays });

    expect(view.daysRead).toBe(2);
  });

  it("sums every event into totalPagesRead", () => {
    const view = toReadingHistoryView({ events: eventsAcrossTwoDays });

    expect(view.totalPagesRead).toBe(150);
  });

  it("preserves the chronological order of the source events", () => {
    const view = toReadingHistoryView({ events: eventsAcrossTwoDays });

    expect(view.events.map((event) => event.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("maps each stored event date to an iso day string", () => {
    const view = toReadingHistoryView({ events: eventsAcrossTwoDays });

    expect(view.events).toEqual([
      { date: "2026-07-05", id: "e1", page: 40, pagesRead: 40 },
      { date: "2026-07-05", id: "e2", page: 90, pagesRead: 50 },
      { date: "2026-07-06", id: "e3", page: 150, pagesRead: 60 },
    ]);
  });

  it("returns empty buckets and zero totals for no events", () => {
    const view = toReadingHistoryView({ events: [] });

    expect(view).toEqual({ daily: [], daysRead: 0, events: [], totalPagesRead: 0 });
  });
});
