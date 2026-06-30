import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module.js";
import { AuthorsController } from "./api/authors.controller.js";
import { AuthorsService } from "./application/authors.service.js";
import { AuthorsRepository } from "./infrastructure/authors.repository.js";
import { OpenLibraryClient } from "./infrastructure/open-library.client.js";
import { WikidataClient } from "./infrastructure/wikidata.client.js";

@Module({
  controllers: [AuthorsController],
  exports: [AuthorsService],
  imports: [AuthModule],
  providers: [AuthorsService, AuthorsRepository, OpenLibraryClient, WikidataClient],
})
export class AuthorsModule {}
