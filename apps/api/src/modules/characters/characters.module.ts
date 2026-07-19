import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { MediaModule } from "../media/index.js";
import { TagsModule } from "../tags/index.js";
import { BookCharacterSuggestionsController } from "./api/book-character-suggestions.controller.js";
import { BookCharacterSummaryController } from "./api/book-character-summary.controller.js";
import { BookCharactersController } from "./api/book-characters.controller.js";
import { CharacterGroupsController } from "./api/character-groups.controller.js";
import { CharactersController } from "./api/characters.controller.js";
import { SeriesCharacterSummaryController } from "./api/series-character-summary.controller.js";
import { SeriesCharactersController } from "./api/series-characters.controller.js";
import { SeriesReadingContextController } from "./api/series-reading-context.controller.js";
import { CharacterGroupsService } from "./application/character-groups.service.js";
import { CharacterPurgeProcessor } from "./application/character-purge.processor.js";
import { CharactersService } from "./application/characters.service.js";
import { CHARACTER_PURGE_QUEUE_NAME } from "./domain/character-purge.js";
import { CharacterGroupsRepository } from "./infrastructure/character-groups.repository.js";
import { CharactersRepository } from "./infrastructure/characters.repository.js";

@Module({
  controllers: [
    CharactersController,
    CharacterGroupsController,
    BookCharactersController,
    BookCharacterSuggestionsController,
    BookCharacterSummaryController,
    SeriesCharactersController,
    SeriesCharacterSummaryController,
    SeriesReadingContextController,
  ],
  imports: [
    AuthModule,
    BooksModule,
    MediaModule,
    TagsModule,
    BullModule.registerQueue({ name: CHARACTER_PURGE_QUEUE_NAME }),
  ],
  providers: [
    CharactersService,
    CharactersRepository,
    CharacterGroupsService,
    CharacterGroupsRepository,
    CharacterPurgeProcessor,
  ],
})
export class CharactersModule {}
