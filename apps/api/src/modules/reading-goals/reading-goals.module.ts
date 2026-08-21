import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { ListsModule } from "../lists/index.js";
import { MediaModule } from "../media/index.js";
import { ReadingGoalsController } from "./api/reading-goals.controller.js";
import { ReadingGoalActivityRecorder } from "./application/reading-goal-activity.recorder.js";
import { ReadingGoalActivityService } from "./application/reading-goal-activity.service.js";
import { ReadingGoalBooksService } from "./application/reading-goal-books.service.js";
import { ReadingGoalCatalogService } from "./application/reading-goal-catalog.service.js";
import { ReadingGoalDetailAssembler } from "./application/reading-goal-detail.assembler.js";
import { ReadingGoalExpirationReconciler } from "./application/reading-goal-expiration.reconciler.js";
import { ReadingGoalInputValidator } from "./application/reading-goal-input.validator.js";
import { ReadingGoalOverviewService } from "./application/reading-goal-overview.service.js";
import { ReadingGoalPlansService } from "./application/reading-goal-plans.service.js";
import { ReadingGoalSnapshotService } from "./application/reading-goal-snapshot.service.js";
import { ReadingGoalSyncService } from "./application/reading-goal-sync.service.js";
import { ReadingGoalViewBuilder } from "./application/reading-goal-view.builder.js";
import { ReadingGoalsService } from "./application/reading-goals.service.js";
import { ReadingGoalActivityRepository } from "./infrastructure/reading-goal-activity.repository.js";
import { ReadingGoalBooksRepository } from "./infrastructure/reading-goal-books.repository.js";
import { ReadingGoalsRepository } from "./infrastructure/reading-goals.repository.js";

@Module({
  controllers: [ReadingGoalsController],
  exports: [ReadingGoalPlansService, ReadingGoalSyncService],
  imports: [AuthModule, ListsModule, MediaModule],
  providers: [
    ReadingGoalsService,
    ReadingGoalActivityRecorder,
    ReadingGoalActivityService,
    ReadingGoalBooksService,
    ReadingGoalCatalogService,
    ReadingGoalDetailAssembler,
    ReadingGoalExpirationReconciler,
    ReadingGoalInputValidator,
    ReadingGoalOverviewService,
    ReadingGoalPlansService,
    ReadingGoalSnapshotService,
    ReadingGoalSyncService,
    ReadingGoalViewBuilder,
    ReadingGoalActivityRepository,
    ReadingGoalBooksRepository,
    ReadingGoalsRepository,
  ],
})
export class ReadingGoalsModule {}
