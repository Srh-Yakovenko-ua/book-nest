import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaModule } from "../media/index.js";
import { BookQuotesController } from "./api/book-quotes.controller.js";
import { QuotesController } from "./api/quotes.controller.js";
import { QuotesService } from "./application/quotes.service.js";
import { QuotesRepository } from "./infrastructure/quotes.repository.js";

@Module({
  controllers: [BookQuotesController, QuotesController],
  imports: [AuthModule, MediaModule],
  providers: [QuotesService, QuotesRepository],
})
export class QuotesModule {}
