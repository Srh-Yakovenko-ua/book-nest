import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { MediaModule } from "../media/index.js";
import { ProfileModule } from "../profile/index.js";
import { SeriesModule } from "../series/index.js";
import { NoteController } from "./api/note.controller.js";
import { NotesController } from "./api/notes.controller.js";
import { NoteLifecycleService } from "./application/note-lifecycle.service.js";
import { NotePostFinishService } from "./application/note-post-finish.service.js";
import { NotePurgeProcessor } from "./application/note-purge.processor.js";
import { NotePurgeReconciler } from "./application/note-purge.reconciler.js";
import { NotePurgeScheduler } from "./application/note-purge.scheduler.js";
import { NoteRediscoveryService } from "./application/note-rediscovery.service.js";
import { NotesFacetsService } from "./application/notes-facets.service.js";
import { NotesOverviewService } from "./application/notes-overview.service.js";
import { NotesSummaryService } from "./application/notes-summary.service.js";
import { NotesService } from "./application/notes.service.js";
import { SeriesBeforeContinuationService } from "./application/series-before-continuation.service.js";
import { NOTE_PURGE_QUEUE_NAME } from "./domain/note-purge.js";
import { NotePostFinishRepository } from "./infrastructure/note-post-finish.repository.js";
import { NoteRediscoveryRepository } from "./infrastructure/note-rediscovery.repository.js";
import { NotesFacetsRepository } from "./infrastructure/notes-facets.repository.js";
import { NotesSummaryRepository } from "./infrastructure/notes-summary.repository.js";
import { NotesRepository } from "./infrastructure/notes.repository.js";
import { SeriesBeforeContinuationRepository } from "./infrastructure/series-before-continuation.repository.js";

@Module({
  controllers: [NoteController, NotesController],
  imports: [
    AuthModule,
    BooksModule,
    SeriesModule,
    MediaModule,
    ProfileModule,
    BullModule.registerQueue({ name: NOTE_PURGE_QUEUE_NAME }),
  ],
  providers: [
    NotesService,
    NotesFacetsService,
    NotesSummaryService,
    NoteLifecycleService,
    NoteRediscoveryService,
    NotePostFinishService,
    SeriesBeforeContinuationService,
    NotesOverviewService,
    NotePurgeScheduler,
    NotePurgeProcessor,
    NotePurgeReconciler,
    NotesRepository,
    NotesFacetsRepository,
    NotesSummaryRepository,
    NoteRediscoveryRepository,
    NotePostFinishRepository,
    SeriesBeforeContinuationRepository,
  ],
})
export class NotesModule {}
