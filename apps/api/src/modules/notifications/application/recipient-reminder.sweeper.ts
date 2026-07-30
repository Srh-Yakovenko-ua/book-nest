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

@Injectable()
export class RecipientReminderSweeper {
  constructor(
    private readonly candidatesRepository: ReminderCandidatesRepository,
    private readonly writer: NotificationWriterService,
  ) {}

  async sweepRecipient(input: RecipientSweepInput): Promise<{ emailQueued: boolean }> {
    const loansQueued = await this.sweepScope({ input, scope: "loans" });
    const deliveriesQueued = await this.sweepScope({ input, scope: "deliveries" });

    return { emailQueued: loansQueued || deliveriesQueued };
  }

  private async sweepDeliveries({
    recipient,
    timezone,
    today,
  }: RecipientSweepInput): Promise<boolean> {
    const window = deliveryReminderWindow({ today });
    const emailPreferenceEnabled = resolveDeliveryEmailPreference(recipient.settings);
    let emailQueued = false;

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
          const written = await this.writeCandidate({
            candidateId: candidate.id,
            emailPreferenceEnabled,
            notification: buildDeliveryReminder({
              candidate: {
                bookId: candidate.book.id,
                bookTitle: candidate.book.title,
                expectedDeliveryDate: candidate.expectedDeliveryDate,
                id: candidate.id,
                storeName: candidate.storeName,
              },
              today,
            }),
            recipient,
            scope: "deliveries",
            timezone,
          });
          emailQueued = written || emailQueued;
        }
      },
    });

    return emailQueued;
  }

  private async sweepLoans({ recipient, timezone, today }: RecipientSweepInput): Promise<boolean> {
    const window = loanReminderWindow({ today });
    const emailPreferenceEnabled = resolveLoanEmailPreference(recipient.settings);
    const leadDays = resolveLoanReminderLeadDays(recipient.settings);
    let emailQueued = false;

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
          const written = await this.writeCandidate({
            candidateId: candidate.id,
            emailPreferenceEnabled,
            notification: buildLoanReminder({
              candidate: {
                bookId: candidate.book.id,
                bookTitle: candidate.book.title,
                expectedReturnDate: candidate.expectedReturnDate,
                id: candidate.id,
                loanDate: candidate.loanDate,
                personName: candidate.personName,
              },
              leadDays,
              today,
            }),
            recipient,
            scope: "loans",
            timezone,
          });
          emailQueued = written || emailQueued;
        }
      },
    });

    return emailQueued;
  }

  private async sweepScope({
    input,
    scope,
  }: {
    input: RecipientSweepInput;
    scope: CandidateScope;
  }): Promise<boolean> {
    try {
      return scope === "loans" ? await this.sweepLoans(input) : await this.sweepDeliveries(input);
    } catch (error) {
      log.error(
        { err: error, scope, timezone: input.timezone, userId: input.recipient.id },
        "reminder sweep failed for a user",
      );
      return false;
    }
  }

  private async writeCandidate({
    candidateId,
    emailPreferenceEnabled,
    notification,
    recipient,
    scope,
    timezone,
  }: {
    candidateId: string;
    emailPreferenceEnabled: boolean;
    notification: Nullable<NotificationDraft>;
    recipient: ReminderRecipientRow;
    scope: CandidateScope;
    timezone: string;
  }): Promise<boolean> {
    if (notification === null) {
      return false;
    }

    try {
      const { emailDeliveryCreated } = await this.writer.write({
        emailPreferenceEnabled,
        emailVerified: recipient.emailVerifiedAt !== null,
        notification,
        userId: recipient.id,
      });
      return emailDeliveryCreated;
    } catch (error) {
      log.error(
        { candidateId, err: error, scope, timezone, userId: recipient.id },
        "reminder write failed for a candidate",
      );
      return false;
    }
  }
}
