import type { DeliveryUiStatus, Nullable, ShipmentStatus, WeekStartDay } from "@app/shared";

import {
  DeliveryUiStatusSchema,
  IN_TRANSIT_ATTENTION_THRESHOLDS,
  ShipmentStatusSchema,
  WEEK_STARTS_ON,
} from "@app/shared";
import { differenceInCalendarDays, lastDayOfWeek, parseISO } from "date-fns";

import { assertNever } from "../../../core/assert-never.js";
import { addDaysToUtcDay, daysBetweenUtcDays, toIsoDate } from "../../../core/iso-date.js";

const ARRIVING_SOON_DAYS = 7;

const SHIPMENT_STATUS = ShipmentStatusSchema.enum;
const UI_STATUS = DeliveryUiStatusSchema.enum;

export type DeliveryDateBounds = {
  dispatchCutoff: Date;
  pickupDeadline: Date;
  soonEnd: Date;
  today: Date;
  weekEnd: Date;
};

export type ShipmentUiStatusSource = {
  expectedDeliveryDate: Nullable<Date>;
  pickupUntil: Nullable<Date>;
  status: ShipmentStatus;
};

export function deliveryDateBounds({
  today,
  weekStartDay,
}: {
  today: Date;
  weekStartDay: WeekStartDay;
}): DeliveryDateBounds {
  const daysFromToday = (days: number): Date => addDaysToUtcDay({ day: today, days });

  return {
    dispatchCutoff: daysFromToday(-IN_TRANSIT_ATTENTION_THRESHOLDS.awaitingDispatchDays),
    pickupDeadline: daysFromToday(IN_TRANSIT_ATTENTION_THRESHOLDS.pickupExpiringDays),
    soonEnd: daysFromToday(ARRIVING_SOON_DAYS),
    today,
    weekEnd: daysFromToday(daysUntilReaderWeekEnd({ today, weekStartDay })),
  };
}

export function getDeliveryUiStatus({
  expectedDeliveryDate,
  today,
}: {
  expectedDeliveryDate: Nullable<Date>;
  today: Date;
}): Nullable<DeliveryUiStatus> {
  return uiStatusFromDueDate({ dueDate: expectedDeliveryDate, today });
}

export function getShipmentUiStatus({
  shipment,
  today,
}: {
  shipment: Nullable<ShipmentUiStatusSource>;
  today: Date;
}): Nullable<DeliveryUiStatus> {
  if (shipment === null) {
    return UI_STATUS.no_delivery_date;
  }

  switch (shipment.status) {
    case SHIPMENT_STATUS.cancelled:
    case SHIPMENT_STATUS.received:
      return null;
    case SHIPMENT_STATUS.in_transit:
    case SHIPMENT_STATUS.ordered:
      return uiStatusFromDueDate({ dueDate: shipment.expectedDeliveryDate, today });
    case SHIPMENT_STATUS.ready_for_pickup:
      return uiStatusFromDueDate({
        dueDate: shipment.pickupUntil ?? shipment.expectedDeliveryDate,
        today,
      });
    default:
      return assertNever(shipment.status);
  }
}

function daysUntilReaderWeekEnd({
  today,
  weekStartDay,
}: {
  today: Date;
  weekStartDay: WeekStartDay;
}): number {
  const calendarDay = parseISO(toIsoDate(today));
  const lastDayOfReaderWeek = lastDayOfWeek(calendarDay, {
    weekStartsOn: WEEK_STARTS_ON[weekStartDay],
  });
  return differenceInCalendarDays(lastDayOfReaderWeek, calendarDay);
}

function uiStatusFromDueDate({
  dueDate,
  today,
}: {
  dueDate: Nullable<Date>;
  today: Date;
}): Nullable<DeliveryUiStatus> {
  if (dueDate === null) {
    return UI_STATUS.no_delivery_date;
  }

  const daysUntilDue = daysBetweenUtcDays({ end: dueDate, start: today });
  if (daysUntilDue < 0) {
    return UI_STATUS.delayed;
  }
  if (daysUntilDue <= ARRIVING_SOON_DAYS) {
    return UI_STATUS.arriving_soon;
  }

  return null;
}
