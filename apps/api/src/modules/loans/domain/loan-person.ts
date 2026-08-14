import type { Nullable } from "@app/shared";

export type LoanContactSource = {
  contact: Nullable<string>;
  id: string;
  name: string;
};

export type LoanPersonView = {
  contact: Nullable<string>;
  loanContactId: string;
  personName: string;
};

type LoanPersonSource = {
  contact: Nullable<string>;
  loanContact: LoanContactSource;
};

export function resolveLoanPerson({ contact, loanContact }: LoanPersonSource): LoanPersonView {
  return {
    contact: contact ?? loanContact.contact,
    loanContactId: loanContact.id,
    personName: loanContact.name,
  };
}
