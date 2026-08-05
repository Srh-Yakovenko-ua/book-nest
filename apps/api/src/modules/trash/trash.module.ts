import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { TrashController } from "./api/trash.controller.js";
import { TrashService } from "./application/trash.service.js";
import { TrashRepository } from "./infrastructure/trash.repository.js";

@Module({
  controllers: [TrashController],
  imports: [AuthModule],
  providers: [TrashService, TrashRepository],
})
export class TrashModule {}
