import type { DeliveryUiStatus, Nullable } from "@app/shared";

import { addDays, differenceInCalendarDays } from "date-fns";

import { startOfUtcDay } from "../../../core/iso-date.js";

const ARRIVING_SOON_DAYS = 7;
const DAYS_FROM_MONDAY_TO_SUNDAY = 6;

export type DeliveryDateBounds = {
  soonEnd: Date;
  today: Date;
  weekEnd: Date;
  weekStart: Date;
};

export function deliveryDateBounds(now: Date): DeliveryDateBounds {
  const today = startOfUtcDay(now);
  const soonEnd = addDays(today, ARRIVING_SOON_DAYS);
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const weekStart = addDays(today, -mondayOffset);
  const weekEnd = addDays(weekStart, DAYS_FROM_MONDAY_TO_SUNDAY);

  return { soonEnd, today, weekEnd, weekStart };
}

export function getDeliveryUiStatus({
  expectedDeliveryDate,
  today,
}: {
  expectedDeliveryDate: Nullable<Date>;
  today: Date;
}): Nullable<DeliveryUiStatus> {
  if (expectedDeliveryDate === null) {
    return "no_delivery_date";
  }

  const daysUntilDelivery = differenceInCalendarDays(expectedDeliveryDate, today);
  if (daysUntilDelivery < 0) {
    return "delayed";
  }
  if (daysUntilDelivery <= ARRIVING_SOON_DAYS) {
    return "arriving_soon";
  }
  return null;
}
