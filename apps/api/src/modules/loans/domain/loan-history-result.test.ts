import { describe, expect, it } from "vitest";

import { deriveLoanHistoryOutcome } from "./loan-history-result.js";

const utc = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

const UTC_TIME_ZONE = "UTC";

describe("deriveLoanHistoryOutcome history result", () => {
  it("is on_time when the book came back on the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-10"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.historyResult).toBe("on_time");
  });

  it("leaves delayDays null when the book came back on the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-10"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.delayDays).toBeNull();
  });

  it("is on_time when the book came back before the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-08"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.historyResult).toBe("on_time");
  });

  it("is late when the book came back after the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-13"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.historyResult).toBe("late");
  });

  it("counts the calendar days past the expected day as delayDays", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-13"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.delayDays).toBe(3);
  });

  it("is no_due_date when the loan has no expected return date", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: null,
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-13"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.historyResult).toBe("no_due_date");
  });

  it("leaves delayDays null when the loan has no expected return date", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: null,
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-13"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.delayDays).toBeNull();
  });
});

describe("deriveLoanHistoryOutcome duration", () => {
  it("counts the calendar days from the loan date to the returned date", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: null,
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-13"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.durationDays).toBe(12);
  });

  it("is zero when the book came back on the day it was taken", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: null,
      loanDate: utc("2026-08-13"),
      returnedAt: utc("2026-08-13"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.durationDays).toBe(0);
  });

  it("is null when the loan has no loan date", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: null,
      returnedAt: utc("2026-08-13"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.durationDays).toBeNull();
  });
});

describe("deriveLoanHistoryOutcome returned day", () => {
  it("resolves a return at the start of the UTC day to that calendar day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: new Date("2026-08-10T00:00:00.000Z"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.returnedDate).toBe("2026-08-10");
  });

  it("resolves a return one second before UTC midnight to that same calendar day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: new Date("2026-08-10T23:59:59.000Z"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.returnedDate).toBe("2026-08-10");
  });

  it("stays on_time for a return one second before UTC midnight of the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: new Date("2026-08-10T23:59:59.000Z"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.historyResult).toBe("on_time");
  });

  it("becomes late one second into the UTC day after the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: new Date("2026-08-11T00:00:01.000Z"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.historyResult).toBe("late");
  });

  it("counts a single delay day one second into the UTC day after the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: new Date("2026-08-11T00:00:01.000Z"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.delayDays).toBe(1);
  });

  it("counts the duration from the calendar day of the return, not from its clock time", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: null,
      loanDate: utc("2026-08-01"),
      returnedAt: new Date("2026-08-13T23:59:59.000Z"),
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome.durationDays).toBe(12);
  });
});

describe("deriveLoanHistoryOutcome reader time zone", () => {
  const RETURNED_AFTER_KYIV_MIDNIGHT = new Date("2026-11-16T23:00:00.000Z");

  it("takes the returned day, the delay, the duration and the result from the Kyiv reader's next day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-11-16"),
      loanDate: utc("2026-11-10"),
      returnedAt: RETURNED_AFTER_KYIV_MIDNIGHT,
      timeZone: "Europe/Kyiv",
    });

    expect(outcome).toEqual({
      delayDays: 1,
      durationDays: 7,
      historyResult: "late",
      returnedDate: "2026-11-17",
    });
  });

  it("keeps the same instant on the expected day for a UTC reader", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-11-16"),
      loanDate: utc("2026-11-10"),
      returnedAt: RETURNED_AFTER_KYIV_MIDNIGHT,
      timeZone: UTC_TIME_ZONE,
    });

    expect(outcome).toEqual({
      delayDays: null,
      durationDays: 6,
      historyResult: "on_time",
      returnedDate: "2026-11-16",
    });
  });
});

describe("deriveLoanHistoryOutcome returned day floored to the loan day", () => {
  const RETURNED_AT_UTC_MIDNIGHT = new Date("2026-08-25T00:00:00.000Z");
  const NEW_YORK_TIME_ZONE = "America/New_York";

  it("moves a New York reader's day that falls before the loan day up to the loan day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-25"),
      loanDate: utc("2026-08-25"),
      returnedAt: RETURNED_AT_UTC_MIDNIGHT,
      timeZone: NEW_YORK_TIME_ZONE,
    });

    expect(outcome).toEqual({
      delayDays: null,
      durationDays: 0,
      historyResult: "on_time",
      returnedDate: "2026-08-25",
    });
  });

  it("keeps the reader's day when the loan has no loan day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: null,
      loanDate: null,
      returnedAt: RETURNED_AT_UTC_MIDNIGHT,
      timeZone: NEW_YORK_TIME_ZONE,
    });

    expect(outcome.returnedDate).toBe("2026-08-24");
  });

  it("keeps the reader's day and its duration when that day falls after the loan day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: null,
      loanDate: utc("2026-08-10"),
      returnedAt: RETURNED_AT_UTC_MIDNIGHT,
      timeZone: NEW_YORK_TIME_ZONE,
    });

    expect(outcome).toMatchObject({ durationDays: 14, returnedDate: "2026-08-24" });
  });
});
