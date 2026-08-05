import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { TimelineEventsController } from "./api/timeline-events.controller.js";
import { TimelinesController } from "./api/timelines.controller.js";
import { TimelineEventOrderingService } from "./application/timeline-event-ordering.service.js";
import { TimelineEventService } from "./application/timeline-event.service.js";
import { TimelineLifecycleService } from "./application/timeline-lifecycle.service.js";
import { TimelinePurgeProcessor } from "./application/timeline-purge.processor.js";
import { TimelinePurgeReconciler } from "./application/timeline-purge.reconciler.js";
import { TimelinePurgeScheduler } from "./application/timeline-purge.scheduler.js";
import { TimelineRelationService } from "./application/timeline-relation.service.js";
import { TimelineService } from "./application/timeline.service.js";
import { TIMELINE_PURGE_QUEUE_NAME } from "./domain/timeline-purge.js";
import { TimelineEventRepository } from "./infrastructure/timeline-event.repository.js";
import { TimelineRepository } from "./infrastructure/timeline.repository.js";

@Module({
  controllers: [TimelinesController, TimelineEventsController],
  imports: [AuthModule, BooksModule, BullModule.registerQueue({ name: TIMELINE_PURGE_QUEUE_NAME })],
  providers: [
    TimelineService,
    TimelineEventService,
    TimelineEventOrderingService,
    TimelineLifecycleService,
    TimelinePurgeScheduler,
    TimelinePurgeProcessor,
    TimelinePurgeReconciler,
    TimelineRelationService,
    TimelineRepository,
    TimelineEventRepository,
  ],
})
export class TimelineModule {}
