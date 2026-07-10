import type { CreateLoanInput } from "@app/shared";

import { describe, expect, it } from "vitest";

import { computeLoanChange } from "./loan-transition.js";

const TODAY = "2026-02-01";
const PARSED_TODAY = new Date("2026-02-01T00:00:00.000Z");
const LOAN_DATE = "2026-01-20";
const PARSED_LOAN_DATE = new Date("2026-01-20T00:00:00.000Z");
const RETURN_DATE = "2026-03-01";
const PARSED_RETURN_DATE = new Date("2026-03-01T00:00:00.000Z");
const RETURNED_AT = new Date("2026-02-10T09:30:00.000Z");

describe("computeLoanChange create direction mapping", () => {
  it("maps a borrowed loan to the borrowed_from_someone ownership status and type", () => {
    const patch = computeLoanChange({
      fields: { direction: "borrowed", personName: "Olha" },
      kind: "create",
      today: TODAY,
    });

    expect(patch.book).toEqual({ ownershipStatus: "borrowed_from_someone" });
    expect(patch.kind === "create" ? patch.loan.type : null).toBe("borrowed_from_someone");
  });

  it("maps a lent loan to the lent_to_someone ownership status and type", () => {
    const patch = computeLoanChange({
      fields: { direction: "lent", personName: "Olha" },
      kind: "create",
      today: TODAY,
    });

    expect(patch.book).toEqual({ ownershipStatus: "lent_to_someone" });
    expect(patch.kind === "create" ? patch.loan.type : null).toBe("lent_to_someone");
  });
});

describe("computeLoanChange create loan info", () => {
  it("overwrites the full loan row with defaults when only the required fields are given", () => {
    const patch = computeLoanChange({
      fields: { direction: "borrowed", personName: "Olha" },
      kind: "create",
      today: TODAY,
    });

    expect(patch.kind === "create" ? patch.loan : null).toEqual({
      contact: null,
      expectedReturnDate: null,
      loanDate: PARSED_TODAY,
      note: null,
      personName: "Olha",
      remindToReturn: false,
      type: "borrowed_from_someone",
    });
  });

  it("carries every provided loan field into the row", () => {
    const fields: CreateLoanInput = {
      contact: "olha@example.com",
      direction: "lent",
      expectedReturnDate: RETURN_DATE,
      loanDate: LOAN_DATE,
      note: "hardcover copy",
      personName: "Olha",
      remindToReturn: true,
    };

    const patch = computeLoanChange({ fields, kind: "create", today: TODAY });

    expect(patch.kind === "create" ? patch.loan : null).toEqual({
      contact: "olha@example.com",
      expectedReturnDate: PARSED_RETURN_DATE,
      loanDate: PARSED_LOAN_DATE,
      note: "hardcover copy",
      personName: "Olha",
      remindToReturn: true,
      type: "lent_to_someone",
    });
  });

  it("defaults the loan date to today when it is omitted", () => {
    const patch = computeLoanChange({
      fields: { direction: "borrowed", personName: "Olha" },
      kind: "create",
      today: TODAY,
    });

    expect(patch.kind === "create" ? patch.loan.loanDate : null).toEqual(PARSED_TODAY);
  });

  it("keeps an explicit null expected return date as null", () => {
    const patch = computeLoanChange({
      fields: { direction: "borrowed", expectedReturnDate: null, personName: "Olha" },
      kind: "create",
      today: TODAY,
    });

    expect(patch.kind === "create" ? patch.loan.expectedReturnDate : "unexpected").toBeNull();
  });
});

describe("computeLoanChange return", () => {
  it("returns a borrowed book to the none ownership status and marks the loan returned", () => {
    const patch = computeLoanChange({
      kind: "return",
      now: RETURNED_AT,
      ownershipStatus: "borrowed_from_someone",
    });

    expect(patch).toEqual({
      book: { ownershipStatus: "none" },
      kind: "return",
      returnedAt: RETURNED_AT,
    });
  });

  it("returns a lent book to the owned ownership status and marks the loan returned", () => {
    const patch = computeLoanChange({
      kind: "return",
      now: RETURNED_AT,
      ownershipStatus: "lent_to_someone",
    });

    expect(patch).toEqual({
      book: { ownershipStatus: "owned" },
      kind: "return",
      returnedAt: RETURNED_AT,
    });
  });
});
