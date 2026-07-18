import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/index.js";
import { BooksModule } from "../books/index.js";
import { MediaModule } from "../media/index.js";
import { SeriesModule } from "../series/index.js";
import { NoteController } from "./api/note.controller.js";
import { NotesController } from "./api/notes.controller.js";
import { NotesService } from "./application/notes.service.js";
import { NotesRepository } from "./infrastructure/notes.repository.js";

@Module({
  controllers: [NoteController, NotesController],
  imports: [AuthModule, BooksModule, SeriesModule, MediaModule],
  providers: [NotesService, NotesRepository],
})
export class NotesModule {}
