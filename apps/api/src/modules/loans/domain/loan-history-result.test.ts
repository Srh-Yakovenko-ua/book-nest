import { describe, expect, it } from "vitest";

import { deriveLoanHistoryOutcome } from "./loan-history-result.js";

const utc = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

describe("deriveLoanHistoryOutcome history result", () => {
  it("is on_time when the book came back on the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-10"),
    });

    expect(outcome.historyResult).toBe("on_time");
  });

  it("leaves delayDays null when the book came back on the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-10"),
    });

    expect(outcome.delayDays).toBeNull();
  });

  it("is on_time when the book came back before the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-08"),
    });

    expect(outcome.historyResult).toBe("on_time");
  });

  it("is late when the book came back after the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-13"),
    });

    expect(outcome.historyResult).toBe("late");
  });

  it("counts the calendar days past the expected day as delayDays", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-13"),
    });

    expect(outcome.delayDays).toBe(3);
  });

  it("is no_due_date when the loan has no expected return date", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: null,
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-13"),
    });

    expect(outcome.historyResult).toBe("no_due_date");
  });

  it("leaves delayDays null when the loan has no expected return date", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: null,
      loanDate: utc("2026-08-01"),
      returnedAt: utc("2026-08-13"),
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
    });

    expect(outcome.durationDays).toBe(12);
  });

  it("is zero when the book came back on the day it was taken", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: null,
      loanDate: utc("2026-08-13"),
      returnedAt: utc("2026-08-13"),
    });

    expect(outcome.durationDays).toBe(0);
  });

  it("is null when the loan has no loan date", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: null,
      returnedAt: utc("2026-08-13"),
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
    });

    expect(outcome.returnedDate).toBe("2026-08-10");
  });

  it("resolves a return one second before UTC midnight to that same calendar day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: new Date("2026-08-10T23:59:59.000Z"),
    });

    expect(outcome.returnedDate).toBe("2026-08-10");
  });

  it("stays on_time for a return one second before UTC midnight of the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: new Date("2026-08-10T23:59:59.000Z"),
    });

    expect(outcome.historyResult).toBe("on_time");
  });

  it("becomes late one second into the UTC day after the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: new Date("2026-08-11T00:00:01.000Z"),
    });

    expect(outcome.historyResult).toBe("late");
  });

  it("counts a single delay day one second into the UTC day after the expected day", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: utc("2026-08-10"),
      loanDate: utc("2026-08-01"),
      returnedAt: new Date("2026-08-11T00:00:01.000Z"),
    });

    expect(outcome.delayDays).toBe(1);
  });

  it("counts the duration from the calendar day of the return, not from its clock time", () => {
    const outcome = deriveLoanHistoryOutcome({
      expectedReturnDate: null,
      loanDate: utc("2026-08-01"),
      returnedAt: new Date("2026-08-13T23:59:59.000Z"),
    });

    expect(outcome.durationDays).toBe(12);
  });
});
