import type { Nullable } from "@app/shared";

import { defaultUserProfileSettings } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { formatInTimeZone } from "date-fns-tz";

import type { ExclusiveTask } from "../../../core/exclusive-task.js";
import type { ReminderRecipientRow } from "../infrastructure/reminder-candidates.repository.js";

import { createExclusiveTask } from "../../../core/exclusive-task.js";
import { parseIsoDate } from "../../../core/iso-date.js";
import { scanByKeyset } from "../../../core/keyset-scan.js";
import { createLogger } from "../../../core/logger.js";
import { deliveryReminderWindow, loanReminderWindow } from "../domain/notification-cadence.js";
import { resolveLocalHour } from "../domain/reminder-settings.js";
import { ReminderCandidatesRepository } from "../infrastructure/reminder-candidates.repository.js";
import { NotificationRealtimePublisher } from "./notification-realtime.publisher.js";
import { NotificationWriterService } from "./notification-writer.service.js";
import { RecipientReminderSweeper } from "./recipient-reminder.sweeper.js";

const NOTIFICATION_SWEEP = {
  defaultTimeZone: defaultUserProfileSettings.timezone,
  localDateFormat: "yyyy-MM-dd",
  maxRecipientPages: 50,
  recipientPageSize: 200,
  sendHour: 9,
} as const;

const SWEEP_SCOPE = "notifications.reminder-sweeper";

const log = createLogger(SWEEP_SCOPE);

@Injectable()
export class NotificationReminderSweeper {
  private readonly runExclusively: ExclusiveTask;

  constructor(
    private readonly candidatesRepository: ReminderCandidatesRepository,
    private readonly realtimePublisher: NotificationRealtimePublisher,
    private readonly recipientSweeper: RecipientReminderSweeper,
    private readonly writer: NotificationWriterService,
  ) {
    this.runExclusively = createExclusiveTask({
      run: () => this.runSafely(),
      scope: SWEEP_SCOPE,
    });
  }

  async run({ now }: { now: Date }): Promise<void> {
    const timezones = await this.candidatesRepository.findCandidateTimezones({
      fallbackTimezone: NOTIFICATION_SWEEP.defaultTimeZone,
    });

    for (const timezone of timezones) {
      await this.sweepTimezoneWhenDue({ now, timezone });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  sweep(): Promise<void> {
    return this.runExclusively();
  }

  private loadRecipientPage({
    afterUserId,
    timezone,
    today,
  }: {
    afterUserId: Nullable<string>;
    timezone: string;
    today: string;
  }): Promise<ReminderRecipientRow[]> {
    const loanWindow = loanReminderWindow({ today });
    const deliveryWindow = deliveryReminderWindow({ today });

    return this.candidatesRepository.findReminderRecipients({
      afterUserId,
      deliveryDueFrom: parseIsoDate(deliveryWindow.fromIsoDate),
      deliveryDueTo: parseIsoDate(deliveryWindow.toIsoDate),
      includeMissingSettings: timezone === NOTIFICATION_SWEEP.defaultTimeZone,
      limit: NOTIFICATION_SWEEP.recipientPageSize,
      loanDueFrom: parseIsoDate(loanWindow.fromIsoDate),
      loanDueTo: parseIsoDate(loanWindow.toIsoDate),
      timezone,
    });
  }

  private async runSafely(): Promise<void> {
    try {
      await this.run({ now: new Date() });
    } catch (error) {
      log.error({ err: error }, "reminder sweep failed");
    }
  }

  private async sweepRecipients({
    now,
    recipients,
    timezone,
    today,
  }: {
    now: Date;
    recipients: ReminderRecipientRow[];
    timezone: string;
    today: string;
  }): Promise<void> {
    for (const recipient of recipients) {
      const { emailQueued, notificationsWritten } = await this.recipientSweeper.sweepRecipient({
        recipient,
        timezone,
        today,
      });

      if (notificationsWritten) {
        await this.realtimePublisher.publishUnreadCount({ userId: recipient.id });
      }
      if (emailQueued) {
        await this.writer.enqueueDigest({ now, userId: recipient.id });
      }
    }
  }

  private async sweepTimezone({ now, timezone }: { now: Date; timezone: string }): Promise<void> {
    const today = formatInTimeZone(now, timezone, NOTIFICATION_SWEEP.localDateFormat);

    const summary = await scanByKeyset<ReminderRecipientRow>({
      loadPage: (afterUserId) => this.loadRecipientPage({ afterUserId, timezone, today }),
      maxPages: NOTIFICATION_SWEEP.maxRecipientPages,
      pageSize: NOTIFICATION_SWEEP.recipientPageSize,
      scope: SWEEP_SCOPE,
      toCursor: (recipient) => recipient.id,
      visitPage: (recipients) => this.sweepRecipients({ now, recipients, timezone, today }),
    });

    log.info(
      { pages: summary.pages, recipients: summary.visited, timezone },
      "swept the reminder recipients of a timezone",
    );
  }

  private async sweepTimezoneWhenDue({
    now,
    timezone,
  }: {
    now: Date;
    timezone: string;
  }): Promise<void> {
    try {
      const localHour = resolveLocalHour({ now, timezone });

      if (localHour === null) {
        await this.warnAboutUnresolvableTimezone({ timezone });
        return;
      }
      if (localHour !== NOTIFICATION_SWEEP.sendHour) {
        return;
      }

      await this.sweepTimezone({ now, timezone });
    } catch (error) {
      log.error({ err: error, timezone }, "reminder sweep failed for a timezone");
    }
  }

  private async warnAboutUnresolvableTimezone({ timezone }: { timezone: string }): Promise<void> {
    const userIds = await this.candidatesRepository.findUserIdsByTimezone({ timezone });
    for (const userId of userIds) {
      log.warn(
        { timezone, userId },
        "skipped reminders for a user whose stored timezone does not resolve",
      );
    }
  }
}
