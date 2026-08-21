import { describe, expect, it } from "vitest";

import { resolveActiveLoanPerson, resolveHistoryLoanPerson } from "./loan-person.js";

const LOAN_CONTACT_ID = "6e9e4c9a-1b1a-4d0c-9c1e-2f4a5b6c7d8e";

describe("resolveActiveLoanPerson", () => {
  it("takes the name and the contact detail from the contact the loan points at", () => {
    const person = resolveActiveLoanPerson({
      loanContact: {
        contact: "current@example.com",
        id: LOAN_CONTACT_ID,
        name: "Ігор Петренко",
      },
    });

    expect(person).toEqual({
      contact: "current@example.com",
      loanContactId: LOAN_CONTACT_ID,
      personName: "Ігор Петренко",
    });
  });

  it("reports no contact detail when the person carries none", () => {
    const person = resolveActiveLoanPerson({
      loanContact: { contact: null, id: LOAN_CONTACT_ID, name: "Ігор" },
    });

    expect(person.contact).toBeNull();
  });
});

describe("resolveHistoryLoanPerson", () => {
  it("keeps the contact detail the finished loan stored when it started", () => {
    const person = resolveHistoryLoanPerson({
      contact: "+380001112233",
      loanContact: {
        contact: "current@example.com",
        id: LOAN_CONTACT_ID,
        name: "Ігор",
      },
    });

    expect(person.contact).toBe("+380001112233");
  });

  it("falls back to the contact detail of the person when the loan stored none", () => {
    const person = resolveHistoryLoanPerson({
      contact: null,
      loanContact: {
        contact: "current@example.com",
        id: LOAN_CONTACT_ID,
        name: "Ігор",
      },
    });

    expect(person.contact).toBe("current@example.com");
  });

  it("still shows the current name of the person rather than the stored one", () => {
    const person = resolveHistoryLoanPerson({
      contact: null,
      loanContact: {
        contact: null,
        id: LOAN_CONTACT_ID,
        name: "Ігор Петренко",
      },
    });

    expect(person).toEqual({
      contact: null,
      loanContactId: LOAN_CONTACT_ID,
      personName: "Ігор Петренко",
    });
  });
});
