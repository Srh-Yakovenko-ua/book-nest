import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaModule } from "../media/index.js";
import { ListsController } from "./api/lists.controller.js";
import { ListLifecycleService } from "./application/list-lifecycle.service.js";
import { ListPurgeProcessor } from "./application/list-purge.processor.js";
import { ListPurgeReconciler } from "./application/list-purge.reconciler.js";
import { ListPurgeScheduler } from "./application/list-purge.scheduler.js";
import { ListsService } from "./application/lists.service.js";
import { LIST_PURGE_QUEUE_NAME } from "./domain/list-purge.js";
import { ListsRepository } from "./infrastructure/lists.repository.js";

@Module({
  controllers: [ListsController],
  exports: [ListsService],
  imports: [AuthModule, MediaModule, BullModule.registerQueue({ name: LIST_PURGE_QUEUE_NAME })],
  providers: [
    ListsService,
    ListLifecycleService,
    ListPurgeScheduler,
    ListPurgeProcessor,
    ListPurgeReconciler,
    ListsRepository,
  ],
})
export class ListsModule {}
