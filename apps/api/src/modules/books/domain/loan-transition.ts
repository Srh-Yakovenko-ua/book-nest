import type {
  CreateLoanInput,
  LoanDirection,
  LoanType,
  Nullable,
  OwnershipStatus,
  UpdateLoanInput,
} from "@app/shared";

import type {
  CreateLoanInfoData,
  LoanChangePatch,
  UpdateActiveLoanData,
} from "../infrastructure/books.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";

export type LoanTransitionInput =
  | { fields: CreateLoanInput; kind: "create"; today: string }
  | { kind: "return"; now: Date; ownershipStatus: OwnershipStatus };

export function buildLoanEditData({
  existingLoanDate,
  input,
}: {
  existingLoanDate: Nullable<Date>;
  input: UpdateLoanInput;
}): UpdateActiveLoanData {
  return {
    contact: input.contact ?? null,
    expectedReturnDate:
      input.expectedReturnDate === undefined || input.expectedReturnDate === null
        ? null
        : parseIsoDate(input.expectedReturnDate),
    loanDate:
      input.loanDate === undefined
        ? existingLoanDate
        : input.loanDate === null
          ? null
          : parseIsoDate(input.loanDate),
    note: input.note ?? null,
    personName: input.personName,
    remindToReturn: input.remindToReturn ?? false,
  };
}

const DIRECTION_LOAN_TYPE: Record<LoanDirection, LoanType> = {
  borrowed: "borrowed_from_someone",
  lent: "lent_to_someone",
};

export function computeLoanChange(input: LoanTransitionInput): LoanChangePatch {
  switch (input.kind) {
    case "create": {
      const type = DIRECTION_LOAN_TYPE[input.fields.direction];
      return {
        book: { ownershipStatus: type },
        kind: "create",
        loan: { ...buildLoanInfo(input.fields, input.today), type },
      };
    }
    case "return":
      return {
        book: {
          ownershipStatus: input.ownershipStatus === "borrowed_from_someone" ? "none" : "owned",
        },
        kind: "return",
        returnedAt: input.now,
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

function toReturnDate(value: Nullable<string> | undefined): Nullable<Date> {
  return value === undefined || value === null ? null : parseIsoDate(value);
}
