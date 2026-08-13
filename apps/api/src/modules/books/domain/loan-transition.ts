import type {
  CreateLoanInput,
  LoanDirection,
  LoanType,
  Nullable,
  OwnershipStatus,
  UpdateLoanInput,
} from "@app/shared";

import { LOAN_REMINDER_LEAD_DAYS } from "@app/shared";

import type {
  CreateLoanInfoData,
  LoanChangePatch,
  UpdateActiveLoanData,
} from "../infrastructure/books.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { buildBookOwnershipFields } from "./book-ownership-fields.js";
import { resolveReminderFields } from "./loan-quick-actions.js";

export type LoanTransitionInput = (
  { fields: CreateLoanInput; kind: "create" } | { kind: "return" }
) & {
  now: Date;
  ownershipStatus: OwnershipStatus;
};

export function buildLoanEditData({
  existingLoanDate,
  existingRemindBeforeDays,
  input,
}: {
  existingLoanDate: Nullable<Date>;
  existingRemindBeforeDays: Nullable<number>;
  input: UpdateLoanInput;
}): UpdateActiveLoanData {
  const expectedReturnDate =
    input.expectedReturnDate === undefined || input.expectedReturnDate === null
      ? null
      : parseIsoDate(input.expectedReturnDate);

  return {
    contact: input.contact ?? null,
    expectedReturnDate,
    loanDate:
      input.loanDate === undefined
        ? existingLoanDate
        : input.loanDate === null
          ? null
          : parseIsoDate(input.loanDate),
    note: input.note ?? null,
    personName: input.personName,
    ...resolveReminderFields({
      expectedReturnDate,
      remindBeforeDays:
        input.remindToReturn === true
          ? (existingRemindBeforeDays ?? LOAN_REMINDER_LEAD_DAYS.default)
          : null,
    }),
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
        book: buildBookOwnershipFields({
          current: input.ownershipStatus,
          next: type,
          now: input.now,
        }),
        kind: "create",
        loan: { ...buildLoanInfo(input.fields), type },
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

function buildLoanInfo(fields: CreateLoanInput): CreateLoanInfoData {
  const expectedReturnDate = toReturnDate(fields.expectedReturnDate);

  return {
    contact: fields.contact ?? null,
    expectedReturnDate,
    loanDate: parseIsoDate(fields.loanDate),
    note: fields.note ?? null,
    personName: fields.personName,
    ...resolveReminderFields({
      expectedReturnDate,
      remindBeforeDays: fields.remindToReturn === true ? LOAN_REMINDER_LEAD_DAYS.default : null,
    }),
  };
}

function toReturnDate(value: Nullable<string> | undefined): Nullable<Date> {
  return value === undefined || value === null ? null : parseIsoDate(value);
}
