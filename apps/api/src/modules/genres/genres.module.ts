import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { GenresController } from "./api/genres.controller.js";
import { GenresService } from "./application/genres.service.js";
import { GenresRepository } from "./infrastructure/genres.repository.js";

@Module({
  controllers: [GenresController],
  exports: [GenresService],
  imports: [AuthModule],
  providers: [GenresService, GenresRepository],
})
export class GenresModule {}
