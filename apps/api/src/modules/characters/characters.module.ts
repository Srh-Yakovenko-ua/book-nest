import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { MediaModule } from "../media/index.js";
import { SpeciesModule } from "../species/index.js";
import { TagsModule } from "../tags/index.js";
import { BookCharacterGraphController } from "./api/book-character-graph.controller.js";
import { BookCharacterRelationshipsController } from "./api/book-character-relationships.controller.js";
import { BookCharacterSuggestionsController } from "./api/book-character-suggestions.controller.js";
import { BookCharacterSummaryController } from "./api/book-character-summary.controller.js";
import { BookCharactersController } from "./api/book-characters.controller.js";
import { CharacterCustomLabelsController } from "./api/character-custom-labels.controller.js";
import { CharacterFactsController } from "./api/character-facts.controller.js";
import { CharacterFormsController } from "./api/character-forms.controller.js";
import { CharacterGraphLayoutsController } from "./api/character-graph-layouts.controller.js";
import { CharacterGroupsController } from "./api/character-groups.controller.js";
import { CharacterMergeController } from "./api/character-merge.controller.js";
import { CharacterPortabilityController } from "./api/character-portability.controller.js";
import { CharacterRelationshipCustomTypesController } from "./api/character-relationship-custom-types.controller.js";
import { CharacterRelationshipRoleSuggestionsController } from "./api/character-relationship-role-suggestions.controller.js";
import { CharacterRelationshipsController } from "./api/character-relationships.controller.js";
import { CharacterTheoriesController } from "./api/character-theories.controller.js";
import { CharactersController } from "./api/characters.controller.js";
import { SeriesCharacterGraphController } from "./api/series-character-graph.controller.js";
import { SeriesCharacterRelationshipsController } from "./api/series-character-relationships.controller.js";
import { SeriesCharacterSummaryController } from "./api/series-character-summary.controller.js";
import { SeriesCharactersController } from "./api/series-characters.controller.js";
import { SeriesReadingContextController } from "./api/series-reading-context.controller.js";
import { BookCharactersService } from "./application/book-characters.service.js";
import { CharacterAccessAsserter } from "./application/character-access.asserter.js";
import { CharacterCustomLabelsService } from "./application/character-custom-labels.service.js";
import { CharacterDetailsAssembler } from "./application/character-details.assembler.js";
import { CharacterFacetsService } from "./application/character-facets.service.js";
import { CharacterFactsService } from "./application/character-facts.service.js";
import { CharacterFormsService } from "./application/character-forms.service.js";
import { CharacterGraphLayoutsService } from "./application/character-graph-layouts.service.js";
import { CharacterGraphService } from "./application/character-graph.service.js";
import { CharacterGroupsService } from "./application/character-groups.service.js";
import { CharacterLifecycleService } from "./application/character-lifecycle.service.js";
import { CharacterMergeService } from "./application/character-merge.service.js";
import { CharacterPortabilityService } from "./application/character-portability.service.js";
import { CharacterPurgeProcessor } from "./application/character-purge.processor.js";
import { CharacterPurgeReconciler } from "./application/character-purge.reconciler.js";
import { CharacterRelationshipPathService } from "./application/character-relationship-path.service.js";
import { CharacterRelationshipsListService } from "./application/character-relationships-list.service.js";
import { CharacterRelationshipsService } from "./application/character-relationships.service.js";
import { CharacterTheoriesService } from "./application/character-theories.service.js";
import { CharacterViewMapper } from "./application/character-view.mapper.js";
import { CharactersService } from "./application/characters.service.js";
import { GlobalCharacterFilterResolver } from "./application/global-character-filter.resolver.js";
import { RelationshipBookStateService } from "./application/relationship-book-state.service.js";
import { RelationshipContextService } from "./application/relationship-context.service.js";
import { RelationshipCustomTypesService } from "./application/relationship-custom-types.service.js";
import { RelationshipReaderScopeResolver } from "./application/relationship-reader-scope.resolver.js";
import { RelationshipRoleSuggestionsService } from "./application/relationship-role-suggestions.service.js";
import { SeriesCharactersService } from "./application/series-characters.service.js";
import { CHARACTER_PURGE_QUEUE_NAME } from "./domain/character-purge.js";
import { CharacterCustomLabelsRepository } from "./infrastructure/character-custom-labels.repository.js";
import { CharacterFacetsRepository } from "./infrastructure/character-facets.repository.js";
import { CharacterFactsRepository } from "./infrastructure/character-facts.repository.js";
import { CharacterFormsRepository } from "./infrastructure/character-forms.repository.js";
import { CharacterGraphLayoutsRepository } from "./infrastructure/character-graph-layouts.repository.js";
import { CharacterGroupsRepository } from "./infrastructure/character-groups.repository.js";
import { CharacterMergeRepository } from "./infrastructure/character-merge.repository.js";
import { CharacterPortabilityRepository } from "./infrastructure/character-portability.repository.js";
import { CharacterRelationshipsListRepository } from "./infrastructure/character-relationships-list.repository.js";
import { CharacterRelationshipsRepository } from "./infrastructure/character-relationships.repository.js";
import { CharacterTheoriesRepository } from "./infrastructure/character-theories.repository.js";
import { CharactersRepository } from "./infrastructure/characters.repository.js";
import { RelationshipCustomTypesRepository } from "./infrastructure/relationship-custom-types.repository.js";
import { RelationshipRoleSuggestionsRepository } from "./infrastructure/relationship-role-suggestions.repository.js";

@Module({
  controllers: [
    CharacterPortabilityController,
    CharactersController,
    CharacterGroupsController,
    CharacterMergeController,
    CharacterRelationshipsController,
    CharacterRelationshipCustomTypesController,
    CharacterRelationshipRoleSuggestionsController,
    CharacterTheoriesController,
    CharacterFactsController,
    CharacterFormsController,
    CharacterCustomLabelsController,
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
    SpeciesModule,
    TagsModule,
    BullModule.registerQueue({ name: CHARACTER_PURGE_QUEUE_NAME }),
  ],
  providers: [
    CharactersService,
    BookCharactersService,
    SeriesCharactersService,
    CharacterLifecycleService,
    CharacterViewMapper,
    CharacterDetailsAssembler,
    CharacterAccessAsserter,
    CharactersRepository,
    GlobalCharacterFilterResolver,
    CharacterFacetsService,
    CharacterFacetsRepository,
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
    RelationshipContextService,
    RelationshipReaderScopeResolver,
    RelationshipBookStateService,
    CharacterRelationshipsRepository,
    CharacterRelationshipsListService,
    CharacterRelationshipsListRepository,
    CharacterRelationshipPathService,
    RelationshipCustomTypesService,
    RelationshipCustomTypesRepository,
    RelationshipRoleSuggestionsService,
    RelationshipRoleSuggestionsRepository,
    CharacterTheoriesService,
    CharacterTheoriesRepository,
    CharacterFactsService,
    CharacterFactsRepository,
    CharacterFormsService,
    CharacterFormsRepository,
    CharacterCustomLabelsService,
    CharacterCustomLabelsRepository,
    CharacterPurgeProcessor,
    CharacterPurgeReconciler,
  ],
})
export class CharactersModule {}
