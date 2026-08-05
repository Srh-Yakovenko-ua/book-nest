import type { NotificationPayload, Nullable } from "@app/shared";

import { NOTIFICATION_TYPES } from "@app/shared";

import type { LoanReminderStage } from "./notification-cadence.js";
import type { NotificationDraft } from "./notification-draft.js";

import { assertNever } from "../../../core/assert-never.js";
import { toIsoDate, toNullableIsoDate } from "../../../core/iso-date.js";
import { dueLoanStage } from "./notification-cadence.js";
import { buildLoanDedupeKey } from "./notification-dedupe.js";
import { BOOK_ENTITY_TYPE } from "./notification-entity-state.js";

export type LoanReminderCandidate = {
  bookId: string;
  bookTitle: string;
  expectedReturnDate: Nullable<Date>;
  id: string;
  loanDate: Nullable<Date>;
  personName: string;
};

type LoanReminderPayload = Extract<
  NotificationPayload,
  {
    type:
      | typeof NOTIFICATION_TYPES.loanDueSoon
      | typeof NOTIFICATION_TYPES.loanDueToday
      | typeof NOTIFICATION_TYPES.loanOverdue;
  }
>;

export function buildLoanReminder({
  candidate,
  leadDays,
  today,
}: {
  candidate: LoanReminderCandidate;
  leadDays: number;
  today: string;
}): Nullable<NotificationDraft> {
  if (candidate.expectedReturnDate === null) {
    return null;
  }

  const dueDate = toIsoDate(candidate.expectedReturnDate);
  const stage = dueLoanStage({
    expectedReturnDate: dueDate,
    leadDays,
    loanDate: toNullableIsoDate(candidate.loanDate),
    today,
  });

  if (stage === null) {
    return null;
  }

  return {
    dedupeKey: buildLoanDedupeKey({ loanId: candidate.id, stage }),
    entityId: candidate.bookId,
    entityType: BOOK_ENTITY_TYPE,
    payload: toLoanPayload({ candidate, dueDate, stage }),
    reason: "loan_opt_in",
    resetsReadState: false,
  };
}

function toLoanPayload({
  candidate,
  dueDate,
  stage,
}: {
  candidate: LoanReminderCandidate;
  dueDate: string;
  stage: LoanReminderStage;
}): LoanReminderPayload {
  const shared = {
    bookId: candidate.bookId,
    bookTitle: candidate.bookTitle,
    dueDate,
    personName: candidate.personName,
  };

  switch (stage.kind) {
    case "due_soon":
      return { ...shared, type: NOTIFICATION_TYPES.loanDueSoon };
    case "due_today":
      return { ...shared, type: NOTIFICATION_TYPES.loanDueToday };
    case "overdue":
      return {
        ...shared,
        daysOverdue: stage.daysOverdue,
        stage: stage.stage,
        type: NOTIFICATION_TYPES.loanOverdue,
      };
    default:
      return assertNever(stage);
  }
}
