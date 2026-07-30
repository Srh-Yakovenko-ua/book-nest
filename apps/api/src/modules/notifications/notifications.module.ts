import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { NotificationsController } from "./api/notifications.controller.js";
import { NotificationsService } from "./application/notifications.service.js";
import { NotificationsRepository } from "./infrastructure/notifications.repository.js";

@Module({
  controllers: [NotificationsController],
  imports: [AuthModule],
  providers: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
