import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MailModule } from "../mail/index.js";
import { RealtimeModule } from "../realtime/index.js";
import { NotificationsController } from "./api/notifications.controller.js";
import { NotificationEmailDispatcher } from "./application/notification-email.dispatcher.js";
import { NotificationEmailProcessor } from "./application/notification-email.processor.js";
import { NotificationPurgeReconciler } from "./application/notification-purge.reconciler.js";
import { NotificationRealtimePublisher } from "./application/notification-realtime.publisher.js";
import { NotificationReminderSweeper } from "./application/notification-reminder.sweeper.js";
import { NotificationWriterService } from "./application/notification-writer.service.js";
import { NotificationsService } from "./application/notifications.service.js";
import { RecipientReminderSweeper } from "./application/recipient-reminder.sweeper.js";
import { NOTIFICATION_EMAIL_QUEUE_NAME } from "./domain/notification-email.js";
import { NotificationDeliveriesRepository } from "./infrastructure/notification-deliveries.repository.js";
import { NotificationsRepository } from "./infrastructure/notifications.repository.js";
import { ReminderCandidatesRepository } from "./infrastructure/reminder-candidates.repository.js";

@Module({
  controllers: [NotificationsController],
  imports: [
    AuthModule,
    MailModule,
    RealtimeModule,
    BullModule.registerQueue({ name: NOTIFICATION_EMAIL_QUEUE_NAME }),
  ],
  providers: [
    NotificationsService,
    NotificationWriterService,
    NotificationRealtimePublisher,
    NotificationReminderSweeper,
    RecipientReminderSweeper,
    NotificationEmailDispatcher,
    NotificationEmailProcessor,
    NotificationPurgeReconciler,
    NotificationsRepository,
    NotificationDeliveriesRepository,
    ReminderCandidatesRepository,
  ],
})
export class NotificationsModule {}
