import { describe, expect, it } from "vitest";

import { resolveLoanPerson } from "./loan-person.js";

const LOAN_CONTACT_ID = "6e9e4c9a-1b1a-4d0c-9c1e-2f4a5b6c7d8e";

describe("resolveLoanPerson", () => {
  it("prefers the current name of the contact over the name the loan stored when it started", () => {
    const person = resolveLoanPerson({
      contact: null,
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

  it("prefers the contact detail the loan overrides over the one the contact carries", () => {
    const person = resolveLoanPerson({
      contact: "+380001112233",
      loanContact: {
        contact: "current@example.com",
        id: LOAN_CONTACT_ID,
        name: "Ігор",
      },
    });

    expect(person.contact).toBe("+380001112233");
  });

  it("reports no contact detail when neither the loan nor the contact carries one", () => {
    const person = resolveLoanPerson({
      contact: null,
      loanContact: { contact: null, id: LOAN_CONTACT_ID, name: "Ігор" },
    });

    expect(person.contact).toBeNull();
  });
});
