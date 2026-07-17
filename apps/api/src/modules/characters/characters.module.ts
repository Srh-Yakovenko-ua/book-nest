import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { MediaModule } from "../media/index.js";
import { BookCharactersController } from "./api/book-characters.controller.js";
import { CharactersController } from "./api/characters.controller.js";
import { CharactersService } from "./application/characters.service.js";
import { CharactersRepository } from "./infrastructure/characters.repository.js";

@Module({
  controllers: [CharactersController, BookCharactersController],
  imports: [AuthModule, BooksModule, MediaModule],
  providers: [CharactersService, CharactersRepository],
})
export class CharactersModule {}
