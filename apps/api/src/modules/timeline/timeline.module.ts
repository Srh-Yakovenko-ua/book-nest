import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { TimelineEventsController } from "./api/timeline-events.controller.js";
import { TimelinesController } from "./api/timelines.controller.js";
import { TimelineEventService } from "./application/timeline-event.service.js";
import { TimelineService } from "./application/timeline.service.js";
import { TimelineEventRepository } from "./infrastructure/timeline-event.repository.js";
import { TimelineRepository } from "./infrastructure/timeline.repository.js";

@Module({
  controllers: [TimelinesController, TimelineEventsController],
  imports: [AuthModule, BooksModule],
  providers: [TimelineService, TimelineEventService, TimelineRepository, TimelineEventRepository],
})
export class TimelineModule {}
