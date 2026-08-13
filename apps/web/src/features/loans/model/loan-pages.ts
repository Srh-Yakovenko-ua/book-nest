import type { LoanType } from "@app/shared";

type LoanPageDefinition = {
  copyKey: "borrowed" | "lent";
  href: "/loans/borrowed" | "/loans/lent";
  otherType: LoanType;
};

export const LOAN_PAGES = {
  borrowed_from_someone: {
    copyKey: "borrowed",
    href: "/loans/borrowed",
    otherType: "lent_to_someone",
  },
  lent_to_someone: {
    copyKey: "lent",
    href: "/loans/lent",
    otherType: "borrowed_from_someone",
  },
} satisfies Record<LoanType, LoanPageDefinition>;
