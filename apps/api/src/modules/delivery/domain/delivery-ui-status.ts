import type { DeliveryUiStatus, Nullable, ShipmentStatus } from "@app/shared";

import { DeliveryUiStatusSchema, ShipmentStatusSchema } from "@app/shared";
import { addDays, differenceInCalendarDays } from "date-fns";

import { assertNever } from "../../../core/assert-never.js";
import { startOfUtcDay } from "../../../core/iso-date.js";

const ARRIVING_SOON_DAYS = 7;
const DAYS_FROM_MONDAY_TO_SUNDAY = 6;

const SHIPMENT_STATUS = ShipmentStatusSchema.enum;
const UI_STATUS = DeliveryUiStatusSchema.enum;

export type DeliveryDateBounds = {
  soonEnd: Date;
  today: Date;
  weekEnd: Date;
  weekStart: Date;
};

export type ShipmentUiStatusSource = {
  expectedDeliveryDate: Nullable<Date>;
  pickupUntil: Nullable<Date>;
  status: ShipmentStatus;
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
  return uiStatusFromExpectedDate({ expectedDeliveryDate, today });
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
      return uiStatusFromExpectedDate({
        expectedDeliveryDate: shipment.expectedDeliveryDate,
        today,
      });
    case SHIPMENT_STATUS.ready_for_pickup:
      return uiStatusFromExpectedDate({
        expectedDeliveryDate: shipment.expectedDeliveryDate ?? shipment.pickupUntil,
        today,
      });
    default:
      return assertNever(shipment.status);
  }
}

function uiStatusFromExpectedDate({
  expectedDeliveryDate,
  today,
}: {
  expectedDeliveryDate: Nullable<Date>;
  today: Date;
}): Nullable<DeliveryUiStatus> {
  if (expectedDeliveryDate === null) {
    return UI_STATUS.no_delivery_date;
  }

  const daysUntilDelivery = differenceInCalendarDays(expectedDeliveryDate, today);
  if (daysUntilDelivery < 0) {
    return UI_STATUS.delayed;
  }
  if (daysUntilDelivery <= ARRIVING_SOON_DAYS) {
    return UI_STATUS.arriving_soon;
  }

  return null;
}
