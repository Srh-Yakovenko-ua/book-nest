import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaModule } from "../media/index.js";
import { ProfileModule } from "../profile/index.js";
import { BookQuotesController } from "./api/book-quotes.controller.js";
import { QuotesController } from "./api/quotes.controller.js";
import { QuoteLifecycleService } from "./application/quote-lifecycle.service.js";
import { QuotePostFinishService } from "./application/quote-post-finish.service.js";
import { QuotePurgeProcessor } from "./application/quote-purge.processor.js";
import { QuotePurgeReconciler } from "./application/quote-purge.reconciler.js";
import { QuotePurgeScheduler } from "./application/quote-purge.scheduler.js";
import { QuoteRediscoveryService } from "./application/quote-rediscovery.service.js";
import { QuotesOverviewService } from "./application/quotes-overview.service.js";
import { QuotesService } from "./application/quotes.service.js";
import { QUOTE_PURGE_QUEUE_NAME } from "./domain/quote-purge.js";
import { QuotePostFinishRepository } from "./infrastructure/quote-post-finish.repository.js";
import { QuoteRediscoveryRepository } from "./infrastructure/quote-rediscovery.repository.js";
import { QuotesRepository } from "./infrastructure/quotes.repository.js";

@Module({
  controllers: [BookQuotesController, QuotesController],
  imports: [
    AuthModule,
    MediaModule,
    ProfileModule,
    BullModule.registerQueue({ name: QUOTE_PURGE_QUEUE_NAME }),
  ],
  providers: [
    QuotesService,
    QuotesOverviewService,
    QuoteLifecycleService,
    QuotePurgeScheduler,
    QuotePurgeProcessor,
    QuotePurgeReconciler,
    QuoteRediscoveryService,
    QuotePostFinishService,
    QuotesRepository,
    QuoteRediscoveryRepository,
    QuotePostFinishRepository,
  ],
})
export class QuotesModule {}
