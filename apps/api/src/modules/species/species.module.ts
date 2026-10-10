import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { SpeciesController } from "./api/species.controller.js";
import { SpeciesService } from "./application/species.service.js";
import { SpeciesCategoryLabelsSource } from "./infrastructure/species-category-labels.source.js";
import { SpeciesRepository } from "./infrastructure/species.repository.js";

@Module({
  controllers: [SpeciesController],
  exports: [SpeciesService],
  imports: [AuthModule],
  providers: [SpeciesService, SpeciesRepository, SpeciesCategoryLabelsSource],
})
export class SpeciesModule {}
