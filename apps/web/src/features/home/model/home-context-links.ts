import type { HomeAttentionGroup, InTransitFilter, Nullable } from "@app/shared";

import { IN_TRANSIT_ATTENTION_FILTER } from "@app/shared";
import { format, parseISO } from "date-fns";
import { createSerializer } from "nuqs";

import { deliveryQueryParsers } from "@/features/delivery";
import { LOAN_PAGES, loansQueryParsers } from "@/features/loans";
import { READING_CALENDAR_PAGE, readingCalendarParsers } from "@/features/statistics";
import { assertNever } from "@/lib/assert-never";

import { HOME_LIBRARY_LINKS, homeBookHref } from "./home-library-links";

const serializeCalendar = createSerializer(readingCalendarParsers);
const serializeDelivery = createSerializer(deliveryQueryParsers);
const serializeLoans = createSerializer(loansQueryParsers);

const HOME_CONTEXT_ROUTES = {
  deliveryInTransit: "/delivery/in-transit",
  goals: "/goals",
  readingQueue: "/reading-queue",
  series: "/series",
} as const;

export const HOME_CONTEXT_LINKS = {
  goals: HOME_CONTEXT_ROUTES.goals,
  readingCalendar: READING_CALENDAR_PAGE.path,
  readingQueue: HOME_CONTEXT_ROUTES.readingQueue,
} as const;

export function homeAttentionHref(group: HomeAttentionGroup): string {
  switch (group.reason) {
    case "delivery_awaiting_dispatch":
      return inTransitHref({ filter: IN_TRANSIT_ATTENTION_FILTER.awaiting_dispatch });
    case "delivery_delayed":
      return inTransitHref({ filter: IN_TRANSIT_ATTENTION_FILTER.delayed });
    case "delivery_pickup_expiring":
      return inTransitHref({ filter: IN_TRANSIT_ATTENTION_FILTER.pickup_expiring });
    case "delivery_ready_for_pickup":
      return inTransitHref({ filter: "ready_for_pickup" });
    case "delivery_unassigned_books":
      return inTransitHref({
        filter: IN_TRANSIT_ATTENTION_FILTER.unassigned_books,
        orderId: group.revealOrderId,
      });
    case "goal_at_risk":
      return homeGoalHref(group.goalId);
    case "loan_overdue":
      return serializeLoans(LOAN_PAGES[group.direction].href, { filter: "overdue" });
    case "loan_return_soon":
      return serializeLoans(LOAN_PAGES[group.direction].href, { filter: "return_soon" });
    case "queue_deadline":
      return group.bookId === null ? HOME_CONTEXT_ROUTES.readingQueue : homeBookHref(group.bookId);
    case "reading_stale":
      return group.bookId === null ? HOME_LIBRARY_LINKS.counts.reading : homeBookHref(group.bookId);
    case "series_order_issue":
      return group.seriesId === null
        ? HOME_CONTEXT_ROUTES.readingQueue
        : homeSeriesHref(group.seriesId);
    default:
      return assertNever(group);
  }
}

export function homeGoalHref(goalId: string): string {
  return `${HOME_CONTEXT_ROUTES.goals}/${goalId}`;
}

export function homeSeriesHref(seriesId: string): string {
  return `${HOME_CONTEXT_ROUTES.series}/${seriesId}`;
}

export function readingCalendarDayHref(day: string): string {
  const date = parseISO(day);
  return serializeCalendar(READING_CALENDAR_PAGE.path, {
    day,
    month: format(date, READING_CALENDAR_PAGE.monthFormat),
    year: format(date, "yyyy"),
  });
}

function inTransitHref({
  filter,
  orderId = null,
}: {
  filter: InTransitFilter;
  orderId?: Nullable<string>;
}): string {
  return serializeDelivery(HOME_CONTEXT_ROUTES.deliveryInTransit, { filter, orderId });
}
