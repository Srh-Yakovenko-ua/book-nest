import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { MediaModule } from "../media/index.js";
import { TagsModule } from "../tags/index.js";
import { BookCharacterGraphController } from "./api/book-character-graph.controller.js";
import { BookCharacterRelationshipsController } from "./api/book-character-relationships.controller.js";
import { BookCharacterSuggestionsController } from "./api/book-character-suggestions.controller.js";
import { BookCharacterSummaryController } from "./api/book-character-summary.controller.js";
import { BookCharactersController } from "./api/book-characters.controller.js";
import { CharacterFormsController } from "./api/character-forms.controller.js";
import { CharacterGraphLayoutsController } from "./api/character-graph-layouts.controller.js";
import { CharacterGroupsController } from "./api/character-groups.controller.js";
import { CharacterMergeController } from "./api/character-merge.controller.js";
import { CharacterPortabilityController } from "./api/character-portability.controller.js";
import { CharacterRelationshipsController } from "./api/character-relationships.controller.js";
import { CharacterTheoriesController } from "./api/character-theories.controller.js";
import { CharactersController } from "./api/characters.controller.js";
import { SeriesCharacterGraphController } from "./api/series-character-graph.controller.js";
import { SeriesCharacterRelationshipsController } from "./api/series-character-relationships.controller.js";
import { SeriesCharacterSummaryController } from "./api/series-character-summary.controller.js";
import { SeriesCharactersController } from "./api/series-characters.controller.js";
import { SeriesReadingContextController } from "./api/series-reading-context.controller.js";
import { CharacterFormsService } from "./application/character-forms.service.js";
import { CharacterGraphLayoutsService } from "./application/character-graph-layouts.service.js";
import { CharacterGraphService } from "./application/character-graph.service.js";
import { CharacterGroupsService } from "./application/character-groups.service.js";
import { CharacterMergeService } from "./application/character-merge.service.js";
import { CharacterPortabilityService } from "./application/character-portability.service.js";
import { CharacterPurgeProcessor } from "./application/character-purge.processor.js";
import { CharacterRelationshipPathService } from "./application/character-relationship-path.service.js";
import { CharacterRelationshipsService } from "./application/character-relationships.service.js";
import { CharacterTheoriesService } from "./application/character-theories.service.js";
import { CharactersService } from "./application/characters.service.js";
import { CHARACTER_PURGE_QUEUE_NAME } from "./domain/character-purge.js";
import { CharacterFormsRepository } from "./infrastructure/character-forms.repository.js";
import { CharacterGraphLayoutsRepository } from "./infrastructure/character-graph-layouts.repository.js";
import { CharacterGroupsRepository } from "./infrastructure/character-groups.repository.js";
import { CharacterMergeRepository } from "./infrastructure/character-merge.repository.js";
import { CharacterPortabilityRepository } from "./infrastructure/character-portability.repository.js";
import { CharacterRelationshipsRepository } from "./infrastructure/character-relationships.repository.js";
import { CharacterTheoriesRepository } from "./infrastructure/character-theories.repository.js";
import { CharactersRepository } from "./infrastructure/characters.repository.js";

@Module({
  controllers: [
    CharacterPortabilityController,
    CharactersController,
    CharacterGroupsController,
    CharacterMergeController,
    CharacterRelationshipsController,
    CharacterTheoriesController,
    CharacterFormsController,
    BookCharactersController,
    BookCharacterRelationshipsController,
    BookCharacterSuggestionsController,
    BookCharacterSummaryController,
    BookCharacterGraphController,
    CharacterGraphLayoutsController,
    SeriesCharactersController,
    SeriesCharacterGraphController,
    SeriesCharacterRelationshipsController,
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
    CharacterGraphService,
    CharacterGraphLayoutsService,
    CharacterGraphLayoutsRepository,
    CharacterGroupsService,
    CharacterGroupsRepository,
    CharacterMergeService,
    CharacterMergeRepository,
    CharacterPortabilityService,
    CharacterPortabilityRepository,
    CharacterRelationshipsService,
    CharacterRelationshipsRepository,
    CharacterRelationshipPathService,
    CharacterTheoriesService,
    CharacterTheoriesRepository,
    CharacterFormsService,
    CharacterFormsRepository,
    CharacterPurgeProcessor,
  ],
})
export class CharactersModule {}
