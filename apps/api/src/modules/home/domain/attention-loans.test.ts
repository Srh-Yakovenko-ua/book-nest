import { describe, expect, it } from "vitest";

import type { LoanDirectionAttention } from "./attention-loans.js";

import { buildLoanAttention } from "./attention-loans.js";

const QUIET: LoanDirectionAttention = {
  nearestReturnDate: null,
  oldestOverdueReturnDate: null,
  overdueCount: 0,
  returningSoonCount: 0,
};

const OVERDUE: LoanDirectionAttention = {
  nearestReturnDate: null,
  oldestOverdueReturnDate: "2026-11-10",
  overdueCount: 2,
  returningSoonCount: 0,
};

const RETURNING_SOON: LoanDirectionAttention = {
  nearestReturnDate: "2026-11-27",
  oldestOverdueReturnDate: null,
  overdueCount: 0,
  returningSoonCount: 3,
};

describe("buildLoanAttention", () => {
  it("raises overdue borrowed books as high, counted in books", () => {
    expect(buildLoanAttention({ borrowed: OVERDUE, lent: QUIET })).toEqual([
      expect.objectContaining({
        count: 2,
        direction: "borrowed_from_someone",
        reason: "loan_overdue",
        severity: "high",
        unit: "books",
      }),
    ]);
  });

  it("raises borrowed books due back soon as high, counted in books", () => {
    expect(buildLoanAttention({ borrowed: RETURNING_SOON, lent: QUIET })).toEqual([
      expect.objectContaining({
        count: 3,
        direction: "borrowed_from_someone",
        reason: "loan_return_soon",
        severity: "high",
        unit: "books",
      }),
    ]);
  });

  it("raises overdue lent books as medium, counted in books", () => {
    expect(buildLoanAttention({ borrowed: QUIET, lent: OVERDUE })).toEqual([
      expect.objectContaining({
        count: 2,
        direction: "lent_to_someone",
        reason: "loan_overdue",
        severity: "medium",
        unit: "books",
      }),
    ]);
  });

  it("raises lent books due back soon as medium, counted in books", () => {
    expect(buildLoanAttention({ borrowed: QUIET, lent: RETURNING_SOON })).toEqual([
      expect.objectContaining({
        count: 3,
        direction: "lent_to_someone",
        reason: "loan_return_soon",
        severity: "medium",
        unit: "books",
      }),
    ]);
  });

  it("raises overdue and due-soon books of one direction as separate groups", () => {
    const groups = buildLoanAttention({
      borrowed: { ...OVERDUE, nearestReturnDate: "2026-11-27", returningSoonCount: 1 },
      lent: QUIET,
    });

    expect(groups).toHaveLength(2);
    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ count: 2, reason: "loan_overdue" }),
        expect.objectContaining({ count: 1, reason: "loan_return_soon" }),
      ]),
    );
  });

  it("raises nothing when no loan is overdue or due back soon", () => {
    expect(buildLoanAttention({ borrowed: QUIET, lent: QUIET })).toEqual([]);
  });
});
