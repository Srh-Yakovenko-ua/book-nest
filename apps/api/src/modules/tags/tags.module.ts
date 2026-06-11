import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { TagsController } from "./api/tags.controller.js";
import { TagsService } from "./application/tags.service.js";
import { TagsRepository } from "./infrastructure/tags.repository.js";

@Module({
  controllers: [TagsController],
  exports: [TagsService],
  imports: [AuthModule],
  providers: [TagsService, TagsRepository],
})
export class TagsModule {}
