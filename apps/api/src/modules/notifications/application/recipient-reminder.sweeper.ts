import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { NotificationDraft } from "../domain/notification-draft.js";
import type {
  DeliveryCandidateRow,
  LoanCandidateRow,
  ReminderRecipientRow,
} from "../infrastructure/reminder-candidates.repository.js";

import { parseIsoDate } from "../../../core/iso-date.js";
import { scanByKeyset } from "../../../core/keyset-scan.js";
import { createLogger } from "../../../core/logger.js";
import { buildDeliveryReminder } from "../domain/delivery-reminder.builder.js";
import { buildLoanReminder } from "../domain/loan-reminder.builder.js";
import { deliveryReminderWindow, loanReminderWindow } from "../domain/notification-cadence.js";
import {
  resolveDeliveryEmailPreference,
  resolveLoanEmailPreference,
  resolveLoanReminderLeadDays,
} from "../domain/reminder-settings.js";
import { ReminderCandidatesRepository } from "../infrastructure/reminder-candidates.repository.js";
import { NotificationWriterService } from "./notification-writer.service.js";

const RECIPIENT_REMINDER_SWEEP = {
  candidatePageSize: 50,
  maxCandidatePages: 20,
} as const;

const SWEEP_SCOPE = "notifications.recipient-sweeper";

const log = createLogger(SWEEP_SCOPE);

type CandidateScope = "deliveries" | "loans";

type RecipientSweepInput = {
  recipient: ReminderRecipientRow;
  timezone: string;
  today: string;
};

type RecipientSweepOutcome = {
  emailQueued: boolean;
  notificationsWritten: boolean;
};

const NOTHING_WRITTEN: RecipientSweepOutcome = { emailQueued: false, notificationsWritten: false };

@Injectable()
export class RecipientReminderSweeper {
  constructor(
    private readonly candidatesRepository: ReminderCandidatesRepository,
    private readonly writer: NotificationWriterService,
  ) {}

  async sweepRecipient(input: RecipientSweepInput): Promise<RecipientSweepOutcome> {
    const loans = await this.sweepLoans(input);
    const deliveries = await this.sweepDeliveries(input);

    return mergeSweepOutcomes([loans, deliveries]);
  }

  private async sweepDeliveries({
    recipient,
    timezone,
    today,
  }: RecipientSweepInput): Promise<RecipientSweepOutcome> {
    const window = deliveryReminderWindow({ today });
    const emailPreferenceEnabled = resolveDeliveryEmailPreference(recipient.settings);
    let outcome = NOTHING_WRITTEN;

    try {
      await scanByKeyset<DeliveryCandidateRow>({
        loadPage: (afterId) =>
          this.candidatesRepository.findDeliveryCandidates({
            afterId,
            dueFrom: parseIsoDate(window.fromIsoDate),
            dueTo: parseIsoDate(window.toIsoDate),
            limit: RECIPIENT_REMINDER_SWEEP.candidatePageSize,
            userId: recipient.id,
          }),
        maxPages: RECIPIENT_REMINDER_SWEEP.maxCandidatePages,
        pageSize: RECIPIENT_REMINDER_SWEEP.candidatePageSize,
        scope: SWEEP_SCOPE,
        toCursor: (candidate) => candidate.id,
        visitPage: async (candidates) => {
          for (const candidate of candidates) {
            const candidateOutcome = await this.writeCandidate({
              buildNotification: () =>
                buildDeliveryReminder({
                  candidate: {
                    bookId: candidate.book.id,
                    bookTitle: candidate.book.title,
                    expectedDeliveryDate: candidate.expectedDeliveryDate,
                    id: candidate.id,
                    storeName: candidate.storeName,
                  },
                  today,
                }),
              candidateId: candidate.id,
              emailPreferenceEnabled,
              recipient,
              scope: "deliveries",
              timezone,
            });
            outcome = mergeSweepOutcomes([outcome, candidateOutcome]);
          }
        },
      });
    } catch (error) {
      log.error(
        { err: error, scope: "deliveries", timezone, userId: recipient.id },
        "reminder sweep failed for a user",
      );
    }

    return outcome;
  }

  private async sweepLoans({
    recipient,
    timezone,
    today,
  }: RecipientSweepInput): Promise<RecipientSweepOutcome> {
    const window = loanReminderWindow({ today });
    const emailPreferenceEnabled = resolveLoanEmailPreference(recipient.settings);
    const leadDays = resolveLoanReminderLeadDays(recipient.settings);
    let outcome = NOTHING_WRITTEN;

    try {
      await scanByKeyset<LoanCandidateRow>({
        loadPage: (afterId) =>
          this.candidatesRepository.findLoanCandidates({
            afterId,
            dueFrom: parseIsoDate(window.fromIsoDate),
            dueTo: parseIsoDate(window.toIsoDate),
            limit: RECIPIENT_REMINDER_SWEEP.candidatePageSize,
            userId: recipient.id,
          }),
        maxPages: RECIPIENT_REMINDER_SWEEP.maxCandidatePages,
        pageSize: RECIPIENT_REMINDER_SWEEP.candidatePageSize,
        scope: SWEEP_SCOPE,
        toCursor: (candidate) => candidate.id,
        visitPage: async (candidates) => {
          for (const candidate of candidates) {
            const candidateOutcome = await this.writeCandidate({
              buildNotification: () =>
                buildLoanReminder({
                  candidate: {
                    bookId: candidate.book.id,
                    bookTitle: candidate.book.title,
                    expectedReturnDate: candidate.expectedReturnDate,
                    id: candidate.id,
                    loanDate: candidate.loanDate,
                    personName: candidate.personName,
                  },
                  leadDays: candidate.remindBeforeDays ?? leadDays,
                  today,
                }),
              candidateId: candidate.id,
              emailPreferenceEnabled,
              recipient,
              scope: "loans",
              timezone,
            });
            outcome = mergeSweepOutcomes([outcome, candidateOutcome]);
          }
        },
      });
    } catch (error) {
      log.error(
        { err: error, scope: "loans", timezone, userId: recipient.id },
        "reminder sweep failed for a user",
      );
    }

    return outcome;
  }

  private async writeCandidate({
    buildNotification,
    candidateId,
    emailPreferenceEnabled,
    recipient,
    scope,
    timezone,
  }: {
    buildNotification: () => Nullable<NotificationDraft>;
    candidateId: string;
    emailPreferenceEnabled: boolean;
    recipient: ReminderRecipientRow;
    scope: CandidateScope;
    timezone: string;
  }): Promise<RecipientSweepOutcome> {
    try {
      const notification = buildNotification();
      if (notification === null) {
        return NOTHING_WRITTEN;
      }

      const { emailDeliveryCreated } = await this.writer.write({
        emailPreferenceEnabled,
        emailVerified: recipient.emailVerifiedAt !== null,
        notification,
        userId: recipient.id,
      });
      return { emailQueued: emailDeliveryCreated, notificationsWritten: true };
    } catch (error) {
      log.error(
        { candidateId, err: error, scope, timezone, userId: recipient.id },
        "reminder write failed for a candidate",
      );
      return NOTHING_WRITTEN;
    }
  }
}

function mergeSweepOutcomes(outcomes: readonly RecipientSweepOutcome[]): RecipientSweepOutcome {
  return {
    emailQueued: outcomes.some((outcome) => outcome.emailQueued),
    notificationsWritten: outcomes.some((outcome) => outcome.notificationsWritten),
  };
}
