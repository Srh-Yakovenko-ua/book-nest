import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { ListsController } from "./api/lists.controller.js";
import { ListsService } from "./application/lists.service.js";
import { ListsRepository } from "./infrastructure/lists.repository.js";

@Module({
  controllers: [ListsController],
  exports: [ListsService],
  imports: [AuthModule],
  providers: [ListsService, ListsRepository],
})
export class ListsModule {}
