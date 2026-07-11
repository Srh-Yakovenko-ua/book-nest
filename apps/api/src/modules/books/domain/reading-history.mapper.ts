import type { ReadingHistoryView } from "@app/shared";

import { toIsoDate } from "../../../core/iso-date.js";

type ReadingEventRow = {
  date: Date;
  id: string;
  page: number;
  pagesRead: number;
};

export function toReadingHistoryView(args: { events: ReadingEventRow[] }): ReadingHistoryView {
  const events = args.events.map((event) => ({
    date: toIsoDate(event.date),
    id: event.id,
    page: event.page,
    pagesRead: event.pagesRead,
  }));

  const pagesReadByDay = new Map<string, number>();
  for (const event of events) {
    pagesReadByDay.set(event.date, (pagesReadByDay.get(event.date) ?? 0) + event.pagesRead);
  }

  const daily = [...pagesReadByDay.entries()].map(([date, pagesRead]) => ({ date, pagesRead }));
  const totalPagesRead = events.reduce((sum, event) => sum + event.pagesRead, 0);

  return {
    daily,
    daysRead: pagesReadByDay.size,
    events,
    totalPagesRead,
  };
}
