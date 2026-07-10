import { addDays } from "date-fns";
import { describe, expect, it } from "vitest";

import { deliveryDateBounds, getDeliveryUiStatus } from "./delivery-ui-status.js";

const TODAY = new Date("2026-07-08T00:00:00.000Z");
const utc = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

describe("getDeliveryUiStatus", () => {
  it("returns no_delivery_date when there is no expected delivery date", () => {
    expect(getDeliveryUiStatus({ expectedDeliveryDate: null, today: TODAY })).toBe(
      "no_delivery_date",
    );
  });

  it("returns delayed when the expected delivery date is before today", () => {
    expect(getDeliveryUiStatus({ expectedDeliveryDate: utc("2026-07-07"), today: TODAY })).toBe(
      "delayed",
    );
  });

  it("returns arriving_soon when the expected delivery date is today", () => {
    expect(getDeliveryUiStatus({ expectedDeliveryDate: utc("2026-07-08"), today: TODAY })).toBe(
      "arriving_soon",
    );
  });

  it("returns arriving_soon when the expected delivery date is exactly seven days away", () => {
    expect(getDeliveryUiStatus({ expectedDeliveryDate: utc("2026-07-15"), today: TODAY })).toBe(
      "arriving_soon",
    );
  });

  it("returns null when the expected delivery date is more than seven days away", () => {
    expect(
      getDeliveryUiStatus({ expectedDeliveryDate: utc("2026-07-16"), today: TODAY }),
    ).toBeNull();
  });
});

describe("deliveryDateBounds", () => {
  it("derives a UTC-midnight today from the given instant", () => {
    const { today } = deliveryDateBounds(new Date("2026-07-08T15:30:00.000Z"));

    expect(today.toISOString()).toBe("2026-07-08T00:00:00.000Z");
  });

  it("sets the soon window seven days after today", () => {
    const { soonEnd, today } = deliveryDateBounds(new Date("2026-07-08T15:30:00.000Z"));

    expect(soonEnd.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    expect(soonEnd.toISOString()).toBe(addDays(today, 7).toISOString());
  });

  it("spans the Monday-to-Sunday week that contains today", () => {
    const { weekEnd, weekStart } = deliveryDateBounds(new Date("2026-07-08T15:30:00.000Z"));

    expect(weekStart.toISOString()).toBe("2026-07-06T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe("2026-07-12T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe(addDays(weekStart, 6).toISOString());
  });

  it("keeps today within the week when the instant falls on a Sunday", () => {
    const { today, weekEnd, weekStart } = deliveryDateBounds(new Date("2026-07-12T23:59:59.000Z"));

    expect(weekStart.toISOString()).toBe("2026-07-06T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe("2026-07-12T00:00:00.000Z");
    expect(today.toISOString()).toBe("2026-07-12T00:00:00.000Z");
  });
});
