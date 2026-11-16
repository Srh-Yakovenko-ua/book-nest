import { describe, expect, it } from "vitest";

import { parseIsoDate, toIsoDate } from "../../../core/iso-date.js";
import { extendReturnDate, resolveReminderFields } from "./loan-quick-actions.js";

const TODAY = parseIsoDate("2026-08-13");

describe("extendReturnDate", () => {
  it("counts from the return date while it is still ahead", () => {
    const extended = extendReturnDate({
      days: 7,
      expectedReturnDate: parseIsoDate("2026-08-20"),
      today: TODAY,
    });

    expect(toIsoDate(extended)).toBe("2026-08-27");
  });

  it("counts from today once the loan is overdue", () => {
    const extended = extendReturnDate({
      days: 14,
      expectedReturnDate: parseIsoDate("2026-08-01"),
      today: TODAY,
    });

    expect(toIsoDate(extended)).toBe("2026-08-27");
  });

  it("counts from a return date that falls today", () => {
    const extended = extendReturnDate({
      days: 7,
      expectedReturnDate: parseIsoDate("2026-08-13"),
      today: TODAY,
    });

    expect(toIsoDate(extended)).toBe("2026-08-20");
  });

  it("counts from the reader's day once it has moved past the return date", () => {
    const extended = extendReturnDate({
      days: 7,
      expectedReturnDate: parseIsoDate("2026-11-16"),
      today: parseIsoDate("2026-11-17"),
    });

    expect(extended.toISOString()).toBe("2026-11-24T00:00:00.000Z");
  });

  it("keeps counting from the return date on the reader's due day", () => {
    const extended = extendReturnDate({
      days: 7,
      expectedReturnDate: parseIsoDate("2026-11-16"),
      today: parseIsoDate("2026-11-16"),
    });

    expect(extended.toISOString()).toBe("2026-11-23T00:00:00.000Z");
  });
});

describe("resolveReminderFields", () => {
  it("turns the reminder on with the chosen lead time", () => {
    expect(
      resolveReminderFields({
        expectedReturnDate: parseIsoDate("2026-08-20"),
        remindBeforeDays: 3,
      }),
    ).toEqual({ remindBeforeDays: 3, remindToReturn: true });
  });

  it("clears both fields when the lead time is dropped", () => {
    expect(
      resolveReminderFields({
        expectedReturnDate: parseIsoDate("2026-08-20"),
        remindBeforeDays: null,
      }),
    ).toEqual({ remindBeforeDays: null, remindToReturn: false });
  });

  it("refuses to keep a reminder without a return date", () => {
    expect(resolveReminderFields({ expectedReturnDate: null, remindBeforeDays: 7 })).toEqual({
      remindBeforeDays: null,
      remindToReturn: false,
    });
  });
});
