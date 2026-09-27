import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { TagsController } from "./api/tags.controller.js";
import { TagsCatalogService } from "./application/tags-catalog.service.js";
import { TagsService } from "./application/tags.service.js";
import { TagsCatalogRepository } from "./infrastructure/tags-catalog.repository.js";
import { TagsRepository } from "./infrastructure/tags.repository.js";

@Module({
  controllers: [TagsController],
  exports: [TagsService],
  imports: [AuthModule],
  providers: [TagsService, TagsRepository, TagsCatalogService, TagsCatalogRepository],
})
export class TagsModule {}
