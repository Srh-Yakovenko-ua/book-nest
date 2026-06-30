import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { PublishersController } from "./api/publishers.controller.js";
import { PublishersService } from "./application/publishers.service.js";
import { PublishersRepository } from "./infrastructure/publishers.repository.js";

@Module({
  controllers: [PublishersController],
  exports: [PublishersService],
  imports: [AuthModule],
  providers: [PublishersService, PublishersRepository],
})
export class PublishersModule {}
