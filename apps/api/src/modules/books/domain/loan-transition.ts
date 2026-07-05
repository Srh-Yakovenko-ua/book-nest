import type { CreateLoanInput, LoanDirection, OwnershipStatus } from "@app/shared";

import type { CreateLoanInfoData, LoanChangePatch } from "../infrastructure/books.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";

export type LoanTransitionInput =
  | { fields: CreateLoanInput; kind: "create"; today: string }
  | { kind: "return"; ownershipStatus: OwnershipStatus };

const DIRECTION_OWNERSHIP_STATUS: Record<LoanDirection, OwnershipStatus> = {
  borrowed: "borrowed_from_someone",
  lent: "lent_to_someone",
};

export function computeLoanChange(input: LoanTransitionInput): LoanChangePatch {
  switch (input.kind) {
    case "create":
      return {
        book: { ownershipStatus: DIRECTION_OWNERSHIP_STATUS[input.fields.direction] },
        loanInfo: buildLoanInfo(input.fields, input.today),
      };
    case "return":
      return {
        book: {
          ownershipStatus: input.ownershipStatus === "borrowed_from_someone" ? "none" : "owned",
        },
        loanInfo: "delete",
      };
    default: {
      const _exhaustiveCheck: never = input;
      return _exhaustiveCheck;
    }
  }
}

function buildLoanInfo(fields: CreateLoanInput, today: string): CreateLoanInfoData {
  return {
    contact: fields.contact ?? null,
    expectedReturnDate: toReturnDate(fields.expectedReturnDate),
    loanDate: parseIsoDate(fields.loanDate ?? today),
    note: fields.note ?? null,
    personName: fields.personName,
    remindToReturn: fields.remindToReturn ?? false,
  };
}

function toReturnDate(value: null | string | undefined): Date | null {
  return value === undefined || value === null ? null : parseIsoDate(value);
}
