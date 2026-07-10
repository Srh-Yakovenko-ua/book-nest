import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { ChangelogController } from "./api/changelog.controller.js";
import { ChangelogService } from "./application/changelog.service.js";
import { ChangelogRepository } from "./infrastructure/changelog.repository.js";

@Module({
  controllers: [ChangelogController],
  imports: [AuthModule],
  providers: [ChangelogService, ChangelogRepository],
})
export class ChangelogModule {}
