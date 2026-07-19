import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { MediaModule } from "../media/index.js";
import { TagsModule } from "../tags/index.js";
import { BookCharacterSuggestionsController } from "./api/book-character-suggestions.controller.js";
import { BookCharactersController } from "./api/book-characters.controller.js";
import { CharactersController } from "./api/characters.controller.js";
import { SeriesCharactersController } from "./api/series-characters.controller.js";
import { SeriesReadingContextController } from "./api/series-reading-context.controller.js";
import { CharacterPurgeProcessor } from "./application/character-purge.processor.js";
import { CharactersService } from "./application/characters.service.js";
import { CHARACTER_PURGE_QUEUE_NAME } from "./domain/character-purge.js";
import { CharactersRepository } from "./infrastructure/characters.repository.js";

@Module({
  controllers: [
    CharactersController,
    BookCharactersController,
    BookCharacterSuggestionsController,
    SeriesCharactersController,
    SeriesReadingContextController,
  ],
  imports: [
    AuthModule,
    BooksModule,
    MediaModule,
    TagsModule,
    BullModule.registerQueue({ name: CHARACTER_PURGE_QUEUE_NAME }),
  ],
  providers: [CharactersService, CharactersRepository, CharacterPurgeProcessor],
})
export class CharactersModule {}
