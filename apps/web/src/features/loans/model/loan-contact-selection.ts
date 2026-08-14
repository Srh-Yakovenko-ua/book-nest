export type LoanContactSelection =
  { contactId: string; kind: "picked"; name: string } | { kind: "saved"; name: string };
