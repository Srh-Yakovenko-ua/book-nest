import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { MediaModule } from "../media/index.js";
import { PublishersController } from "./api/publishers.controller.js";
import { PublishersService } from "./application/publishers.service.js";
import { PublisherOverviewRepository } from "./infrastructure/publisher-overview.repository.js";
import { PublishersRepository } from "./infrastructure/publishers.repository.js";

@Module({
  controllers: [PublishersController],
  exports: [PublishersService],
  imports: [AuthModule, MediaModule],
  providers: [PublishersService, PublishersRepository, PublisherOverviewRepository],
})
export class PublishersModule {}
