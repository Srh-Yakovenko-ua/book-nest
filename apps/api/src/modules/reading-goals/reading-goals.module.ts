import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { ListsModule } from "../lists/index.js";
import { MediaModule } from "../media/index.js";
import { ReadingGoalsController } from "./api/reading-goals.controller.js";
import { ReadingGoalDetailAssembler } from "./application/reading-goal-detail.assembler.js";
import { ReadingGoalViewBuilder } from "./application/reading-goal-view.builder.js";
import { ReadingGoalsService } from "./application/reading-goals.service.js";
import { ReadingGoalsRepository } from "./infrastructure/reading-goals.repository.js";

@Module({
  controllers: [ReadingGoalsController],
  imports: [AuthModule, ListsModule, MediaModule],
  providers: [
    ReadingGoalsService,
    ReadingGoalDetailAssembler,
    ReadingGoalViewBuilder,
    ReadingGoalsRepository,
  ],
})
export class ReadingGoalsModule {}
