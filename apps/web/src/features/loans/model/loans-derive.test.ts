import { describe, expect, it } from "vitest";

import { daysBetweenLoanDates, formatLoanDate, loanRelative, loanTerm } from "./loans-derive";

describe("formatLoanDate", () => {
  it("formats an ISO date as dd.MM.yyyy", () => {
    expect(formatLoanDate("2024-05-24")).toBe("24.05.2024");
  });

  it("returns null for a null value", () => {
    expect(formatLoanDate(null)).toBeNull();
  });

  it("returns null for a malformed value", () => {
    expect(formatLoanDate("24-05-2024")).toBeNull();
  });
});

describe("loanRelative", () => {
  const today = "2024-05-24";

  it("is none when there is no return date", () => {
    expect(loanRelative(null, today)).toEqual({ kind: "none" });
  });

  it("is today when the return date matches today", () => {
    expect(loanRelative("2024-05-24", today)).toEqual({ kind: "today" });
  });

  it("counts overdue days as a positive number", () => {
    expect(loanRelative("2024-05-21", today)).toEqual({ days: 3, kind: "overdue" });
  });

  it("counts upcoming days as a positive number", () => {
    expect(loanRelative("2024-05-26", today)).toEqual({ days: 2, kind: "soon" });
  });
});

describe("loanTerm", () => {
  const today = "2024-05-24";

  it("names the day instead of counting to it", () => {
    expect(loanTerm("2024-05-24", today)).toEqual({ kind: "today" });
    expect(loanTerm("2024-05-25", today)).toEqual({ kind: "tomorrow" });
  });

  it("counts the days left from the day after tomorrow on", () => {
    expect(loanTerm("2024-05-29", today)).toEqual({ days: 5, kind: "inDays" });
  });

  it("counts how long a return is overdue", () => {
    expect(loanTerm("2024-05-16", today)).toEqual({ days: 8, kind: "overdue" });
  });

  it("has no term without a return date", () => {
    expect(loanTerm(null, today)).toEqual({ kind: "none" });
  });
});

describe("daysBetweenLoanDates", () => {
  it("counts calendar days between two ISO days", () => {
    expect(daysBetweenLoanDates("2024-05-12", "2024-05-24")).toBe(12);
  });

  it("returns a negative count when the dates are reversed", () => {
    expect(daysBetweenLoanDates("2024-05-24", "2024-05-12")).toBe(-12);
  });

  it("returns null for a missing or malformed date", () => {
    expect(daysBetweenLoanDates(null, "2024-05-24")).toBeNull();
    expect(daysBetweenLoanDates("2024-05-12", null)).toBeNull();
    expect(daysBetweenLoanDates("12.05.2024", "2024-05-24")).toBeNull();
  });
});
