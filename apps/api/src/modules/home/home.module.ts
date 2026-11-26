import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { DeliveryModule } from "../delivery/index.js";
import { LoansModule } from "../loans/index.js";
import { MediaModule } from "../media/index.js";
import { ProfileModule } from "../profile/index.js";
import { ReadingGoalsModule } from "../reading-goals/index.js";
import { SeriesOrderCheckModule } from "../series-order-check/index.js";
import { SeriesModule } from "../series/index.js";
import { StatisticsModule } from "../statistics/index.js";
import { HomeController } from "./api/home.controller.js";
import { HomeActiveBooksService } from "./application/home-active-books.service.js";
import { HomeAttentionService } from "./application/home-attention.service.js";
import { HomeBookFactsLoader } from "./application/home-book-facts.loader.js";
import { HomeNextReadService } from "./application/home-next-read.service.js";
import { HomeReadingService } from "./application/home-reading.service.js";
import { HomeActiveBooksRepository } from "./infrastructure/home-active-books.repository.js";
import { HomeAttentionRepository } from "./infrastructure/home-attention.repository.js";
import { HomeBookPresentationRepository } from "./infrastructure/home-book-presentation.repository.js";
import { HomeNextReadRepository } from "./infrastructure/home-next-read.repository.js";

@Module({
  controllers: [HomeController],
  imports: [
    AuthModule,
    DeliveryModule,
    LoansModule,
    MediaModule,
    ProfileModule,
    ReadingGoalsModule,
    SeriesModule,
    SeriesOrderCheckModule,
    StatisticsModule,
  ],
  providers: [
    HomeActiveBooksService,
    HomeAttentionService,
    HomeBookFactsLoader,
    HomeNextReadService,
    HomeReadingService,
    HomeActiveBooksRepository,
    HomeAttentionRepository,
    HomeBookPresentationRepository,
    HomeNextReadRepository,
  ],
})
export class HomeModule {}
