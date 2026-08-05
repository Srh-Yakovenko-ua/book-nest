import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { MediaModule } from "../media/index.js";
import { SeriesModule } from "../series/index.js";
import { NoteController } from "./api/note.controller.js";
import { NotesController } from "./api/notes.controller.js";
import { NoteLifecycleService } from "./application/note-lifecycle.service.js";
import { NotePurgeProcessor } from "./application/note-purge.processor.js";
import { NotePurgeReconciler } from "./application/note-purge.reconciler.js";
import { NotePurgeScheduler } from "./application/note-purge.scheduler.js";
import { NotesService } from "./application/notes.service.js";
import { NOTE_PURGE_QUEUE_NAME } from "./domain/note-purge.js";
import { NotesRepository } from "./infrastructure/notes.repository.js";

@Module({
  controllers: [NoteController, NotesController],
  imports: [
    AuthModule,
    BooksModule,
    SeriesModule,
    MediaModule,
    BullModule.registerQueue({ name: NOTE_PURGE_QUEUE_NAME }),
  ],
  providers: [
    NotesService,
    NoteLifecycleService,
    NotePurgeScheduler,
    NotePurgeProcessor,
    NotePurgeReconciler,
    NotesRepository,
  ],
})
export class NotesModule {}
