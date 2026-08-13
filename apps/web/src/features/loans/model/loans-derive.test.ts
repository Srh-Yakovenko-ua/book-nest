import type { LoanListItemView } from "@app/shared";

import { describe, expect, it } from "vitest";

import { daysBetweenLoanDates, formatLoanDate, loanRelative, nearestReturns } from "./loans-derive";

function makeLoan(overrides: Partial<LoanListItemView> = {}): LoanListItemView {
  return {
    book: {
      cover: null,
      firstAuthorName: "Ребекка Яррос",
      id: "book-1",
      originalTitle: null,
      ownershipStatus: "borrowed_from_someone",
      publisher: null,
      title: "Четверте крило",
    },
    contact: null,
    createdAt: "2024-05-12T00:00:00.000Z",
    expectedReturnDate: null,
    id: "loan-1",
    loanDate: "2024-05-12",
    loanUiStatus: "on_time",
    note: null,
    personName: "Олена Коваль",
    remindToReturn: false,
    type: "borrowed_from_someone",
    updatedAt: "2024-05-12T00:00:00.000Z",
    ...overrides,
  };
}

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

describe("nearestReturns", () => {
  const today = "2024-05-24";

  it("keeps only upcoming returns, soonest first", () => {
    const items = [
      makeLoan({ expectedReturnDate: "2024-05-28", id: "b" }),
      makeLoan({ expectedReturnDate: "2024-05-20", id: "past" }),
      makeLoan({ expectedReturnDate: "2024-05-24", id: "a" }),
      makeLoan({ expectedReturnDate: null, id: "none" }),
    ];

    expect(nearestReturns(items, today).map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("formats the date as dd.MM and caps the list to the limit", () => {
    const items = Array.from({ length: 8 }, (_, index) =>
      makeLoan({ expectedReturnDate: `2024-06-0${index + 1}`, id: `loan-${index}` }),
    );

    const result = nearestReturns(items, today);
    expect(result).toHaveLength(5);
    expect(result[0]?.date).toBe("01.06");
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
