import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { ReadingQueueController } from "./api/reading-queue.controller.js";
import { ReadingQueueService } from "./application/reading-queue.service.js";
import { ReadingQueueRepository } from "./infrastructure/reading-queue.repository.js";

@Module({
  controllers: [ReadingQueueController],
  imports: [AuthModule, BooksModule],
  providers: [ReadingQueueService, ReadingQueueRepository],
})
export class ReadingQueueModule {}
