import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { ProfileModule } from "../profile/index.js";
import { ReadingQueueController } from "./api/reading-queue.controller.js";
import { ReadingQueueService } from "./application/reading-queue.service.js";
import { ReadingQueueRepository } from "./infrastructure/reading-queue.repository.js";

@Module({
  controllers: [ReadingQueueController],
  exports: [ReadingQueueRepository],
  imports: [AuthModule, BooksModule, ProfileModule],
  providers: [ReadingQueueService, ReadingQueueRepository],
})
export class ReadingQueueModule {}
