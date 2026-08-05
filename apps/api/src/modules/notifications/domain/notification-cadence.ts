import type { Nullable } from "@app/shared";

import { LOAN_REMINDER_LEAD_DAYS, NOTIFICATION_BOUNDS } from "@app/shared";

import { addDaysToIsoDate, daysBetweenIsoDates } from "../../../core/iso-date.js";

const OVERDUE_STAGE_DAYS: readonly number[] = [7, 14, 21] as const satisfies {
  length: typeof NOTIFICATION_BOUNDS.overdueStageMax;
};

const LOAN_REMINDER_CADENCE = {
  leadDaysMax: LOAN_REMINDER_LEAD_DAYS.max,
  leadDaysMin: LOAN_REMINDER_LEAD_DAYS.min,
  overdueStageDays: OVERDUE_STAGE_DAYS,
} as const;

const DELIVERY_REMINDER_CADENCE = {
  arrivingSoonDays: 3,
  delayedDays: 3,
} as const;

export type DeliveryReminderStage = "arriving_soon" | "arriving_today" | "delayed";

export type LoanReminderStage =
  | { daysOverdue: number; kind: "overdue"; stage: number }
  | { kind: "due_soon" }
  | { kind: "due_today" };

type ReminderDateWindow = {
  fromIsoDate: string;
  toIsoDate: string;
};

export function deliveryReminderWindow({ today }: { today: string }): ReminderDateWindow {
  return {
    fromIsoDate: addDaysToIsoDate(today, -DELIVERY_REMINDER_CADENCE.delayedDays),
    toIsoDate: addDaysToIsoDate(today, DELIVERY_REMINDER_CADENCE.arrivingSoonDays),
  };
}

export function deliveryStage({
  expectedDeliveryDate,
  today,
}: {
  expectedDeliveryDate: string;
  today: string;
}): Nullable<DeliveryReminderStage> {
  const daysSinceExpected = daysBetweenIsoDates({
    endIsoDate: today,
    startIsoDate: expectedDeliveryDate,
  });

  if (daysSinceExpected === -DELIVERY_REMINDER_CADENCE.arrivingSoonDays) {
    return "arriving_soon";
  }
  if (daysSinceExpected === 0) {
    return "arriving_today";
  }
  if (daysSinceExpected === DELIVERY_REMINDER_CADENCE.delayedDays) {
    return "delayed";
  }
  return null;
}

export function dueLoanStage({
  expectedReturnDate,
  leadDays,
  loanDate,
  today,
}: {
  expectedReturnDate: string;
  leadDays: number;
  loanDate: Nullable<string>;
  today: string;
}): Nullable<LoanReminderStage> {
  const daysSinceDue = daysBetweenIsoDates({ endIsoDate: today, startIsoDate: expectedReturnDate });

  if (daysSinceDue === 0) {
    return { kind: "due_today" };
  }

  const overdueIndex = LOAN_REMINDER_CADENCE.overdueStageDays.indexOf(daysSinceDue);
  if (overdueIndex !== -1) {
    return { daysOverdue: daysSinceDue, kind: "overdue", stage: overdueIndex + 1 };
  }

  const effectiveLead = resolveEffectiveLeadDays({ expectedReturnDate, leadDays, loanDate });
  if (effectiveLead !== null && daysSinceDue === -effectiveLead) {
    return { kind: "due_soon" };
  }

  return null;
}

export function loanReminderWindow({ today }: { today: string }): ReminderDateWindow {
  return {
    fromIsoDate: addDaysToIsoDate(today, -Math.max(...LOAN_REMINDER_CADENCE.overdueStageDays)),
    toIsoDate: addDaysToIsoDate(today, LOAN_REMINDER_CADENCE.leadDaysMax),
  };
}

function resolveEffectiveLeadDays({
  expectedReturnDate,
  leadDays,
  loanDate,
}: {
  expectedReturnDate: string;
  leadDays: number;
  loanDate: Nullable<string>;
}): Nullable<number> {
  if (loanDate === null) {
    return leadDays;
  }

  const loanPeriodDays = daysBetweenIsoDates({
    endIsoDate: expectedReturnDate,
    startIsoDate: loanDate,
  });
  const clampedLead = Math.min(leadDays, loanPeriodDays - 1);
  return clampedLead < LOAN_REMINDER_CADENCE.leadDaysMin ? null : clampedLead;
}
