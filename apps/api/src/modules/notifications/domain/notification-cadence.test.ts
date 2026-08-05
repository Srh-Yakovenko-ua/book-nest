import type { Nullable } from "@app/shared";

import { describe, expect, it } from "vitest";

import type { LoanReminderStage } from "./notification-cadence.js";

import { addDaysToIsoDate } from "../../../core/iso-date.js";
import {
  deliveryReminderWindow,
  deliveryStage,
  dueLoanStage,
  loanReminderWindow,
} from "./notification-cadence.js";

const DUE_DATE = "2026-07-30";
const DEFAULT_LEAD_DAYS = 3;
const SCAN_DAYS_BEFORE = 30;
const SCAN_DAYS_AFTER = 40;

function collectFiringOffsets(stageOn: (offsetDays: number) => Nullable<unknown>): number[] {
  const firingOffsets: number[] = [];

  for (let offset = -SCAN_DAYS_BEFORE; offset <= SCAN_DAYS_AFTER; offset += 1) {
    if (stageOn(offset) !== null) {
      firingOffsets.push(offset);
    }
  }

  return firingOffsets;
}

function deliveryStageOnOffset(offsetDays: number): Nullable<string> {
  return deliveryStage({
    expectedDeliveryDate: DUE_DATE,
    today: addDaysToIsoDate(DUE_DATE, offsetDays),
  });
}

function stageOnOffset(offsetDays: number): Nullable<LoanReminderStage> {
  return dueLoanStage({
    expectedReturnDate: DUE_DATE,
    leadDays: DEFAULT_LEAD_DAYS,
    loanDate: null,
    today: addDaysToIsoDate(DUE_DATE, offsetDays),
  });
}

function stageOnOffsetWithLoanDate({
  leadDays,
  loanDateOffsetDays,
}: {
  leadDays: number;
  loanDateOffsetDays: number;
}): (offsetDays: number) => Nullable<LoanReminderStage> {
  return (offsetDays) =>
    dueLoanStage({
      expectedReturnDate: DUE_DATE,
      leadDays,
      loanDate: addDaysToIsoDate(DUE_DATE, loanDateOffsetDays),
      today: addDaysToIsoDate(DUE_DATE, offsetDays),
    });
}

describe("dueLoanStage", () => {
  it("fires due_soon exactly on the lead day", () => {
    expect(stageOnOffset(-DEFAULT_LEAD_DAYS)).toEqual({ kind: "due_soon" });
  });

  it("fires due_today exactly on the due date", () => {
    expect(stageOnOffset(0)).toEqual({ kind: "due_today" });
  });

  it("fires the three overdue stages on their exact offset days", () => {
    expect(stageOnOffset(7)).toEqual({ daysOverdue: 7, kind: "overdue", stage: 1 });
    expect(stageOnOffset(14)).toEqual({ daysOverdue: 14, kind: "overdue", stage: 2 });
    expect(stageOnOffset(21)).toEqual({ daysOverdue: 21, kind: "overdue", stage: 3 });
  });

  it("fires on the boundary days only and stays null on every day between them", () => {
    expect(collectFiringOffsets(stageOnOffset)).toEqual([-DEFAULT_LEAD_DAYS, 0, 7, 14, 21]);
  });

  it("fires on the clamped lead day only when the loan period is shorter than the lead time", () => {
    const stageOnDay = stageOnOffsetWithLoanDate({ leadDays: 7, loanDateOffsetDays: -2 });

    expect(collectFiringOffsets(stageOnDay)).toEqual([-1, 0, 7, 14, 21]);
    expect(stageOnDay(-1)).toEqual({ kind: "due_soon" });
    expect(stageOnDay(0)).toEqual({ kind: "due_today" });
  });

  it("skips the due_soon day entirely for a one-day loan period", () => {
    const stageOnDay = stageOnOffsetWithLoanDate({ leadDays: 7, loanDateOffsetDays: -1 });

    expect(collectFiringOffsets(stageOnDay)).toEqual([0, 7, 14, 21]);
    expect(stageOnDay(0)).toEqual({ kind: "due_today" });
  });

  it("stays null forever past the last overdue stage", () => {
    expect(stageOnOffset(22)).toBeNull();
    expect(stageOnOffset(28)).toBeNull();
    expect(stageOnOffset(365)).toBeNull();
  });

  it("uses the lead time unclamped when the loan date is unknown", () => {
    expect(
      dueLoanStage({
        expectedReturnDate: DUE_DATE,
        leadDays: 14,
        loanDate: null,
        today: addDaysToIsoDate(DUE_DATE, -14),
      }),
    ).toEqual({ kind: "due_soon" });
  });
});

describe("deliveryStage", () => {
  it("fires on the three exact offset days and nowhere else", () => {
    expect(deliveryStageOnOffset(-3)).toBe("arriving_soon");
    expect(deliveryStageOnOffset(0)).toBe("arriving_today");
    expect(deliveryStageOnOffset(3)).toBe("delayed");
    expect(collectFiringOffsets(deliveryStageOnOffset)).toEqual([-3, 0, 3]);
  });
});

describe("reminder windows", () => {
  it("spans every day a loan stage can fire on", () => {
    expect(loanReminderWindow({ today: DUE_DATE })).toEqual({
      fromIsoDate: addDaysToIsoDate(DUE_DATE, -21),
      toIsoDate: addDaysToIsoDate(DUE_DATE, 14),
    });
  });

  it("spans every day a delivery stage can fire on", () => {
    expect(deliveryReminderWindow({ today: DUE_DATE })).toEqual({
      fromIsoDate: addDaysToIsoDate(DUE_DATE, -3),
      toIsoDate: addDaysToIsoDate(DUE_DATE, 3),
    });
  });
});
