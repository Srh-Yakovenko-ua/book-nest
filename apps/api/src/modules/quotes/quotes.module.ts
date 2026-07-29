import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaModule } from "../media/index.js";
import { BookQuotesController } from "./api/book-quotes.controller.js";
import { QuotesController } from "./api/quotes.controller.js";
import { QuoteLifecycleService } from "./application/quote-lifecycle.service.js";
import { QuotePurgeProcessor } from "./application/quote-purge.processor.js";
import { QuotePurgeReconciler } from "./application/quote-purge.reconciler.js";
import { QuotePurgeScheduler } from "./application/quote-purge.scheduler.js";
import { QuotesService } from "./application/quotes.service.js";
import { QUOTE_PURGE_QUEUE_NAME } from "./domain/quote-purge.js";
import { QuotesRepository } from "./infrastructure/quotes.repository.js";

@Module({
  controllers: [BookQuotesController, QuotesController],
  imports: [AuthModule, MediaModule, BullModule.registerQueue({ name: QUOTE_PURGE_QUEUE_NAME })],
  providers: [
    QuotesService,
    QuoteLifecycleService,
    QuotePurgeScheduler,
    QuotePurgeProcessor,
    QuotePurgeReconciler,
    QuotesRepository,
  ],
})
export class QuotesModule {}
