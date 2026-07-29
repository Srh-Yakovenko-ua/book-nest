import type { NoteDeletionResult, PaginatedTrashedNotes, TrashedNotesQuery } from "@app/shared";

import { NOTE_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { toTrashedNoteView } from "../domain/trashed-note.mapper.js";
import { NotesRepository } from "../infrastructure/notes.repository.js";
import { NotePurgeScheduler } from "./note-purge.scheduler.js";

const NOTE_NOT_FOUND_MESSAGE = "Note not found";

@Injectable()
export class NoteLifecycleService {
  constructor(
    private readonly notesRepository: NotesRepository,
    private readonly purgeScheduler: NotePurgeScheduler,
  ) {}

  async listTrash({
    query,
    userId,
  }: {
    query: TrashedNotesQuery;
    userId: string;
  }): Promise<PaginatedTrashedNotes> {
    const { skip, take } = pageSlice(query);
    const [rows, totalCount] = await Promise.all([
      this.notesRepository.listTrashed({ skip, take, userId }),
      this.notesRepository.countTrashed({ userId }),
    ]);

    return buildPaginator({
      items: rows.map(toTrashedNoteView),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async purge({ noteId, userId }: { noteId: string; userId: string }): Promise<void> {
    const note = await this.notesRepository.findForPurge({ noteId, userId });
    if (note === null || note.deletedAt === null) {
      return;
    }

    await this.notesRepository.hardDeleteIfTrashed({
      deletedBefore: TRASH_RETENTION.purgeThreshold(new Date()),
      noteId,
      userId,
    });
  }

  async restore({ noteId, userId }: { noteId: string; userId: string }): Promise<void> {
    const restored = await this.notesRepository.restore({ noteId, userId });
    if (restored === 0) {
      throw new NotFoundError(NOTE_NOT_FOUND_MESSAGE, { code: NOTE_ERROR_CODES.noteNotFound });
    }

    await this.purgeScheduler.cancel(noteId);
  }

  async softDelete({
    noteId,
    userId,
  }: {
    noteId: string;
    userId: string;
  }): Promise<NoteDeletionResult> {
    const deletedAt = new Date();
    const affected = await this.notesRepository.softDelete({ deletedAt, noteId, userId });
    if (affected === 0) {
      throw new NotFoundError(NOTE_NOT_FOUND_MESSAGE, { code: NOTE_ERROR_CODES.noteNotFound });
    }

    await this.purgeScheduler.schedule({ noteId, userId });

    return {
      deletedAt: deletedAt.toISOString(),
      noteId,
      purgeAt: TRASH_RETENTION.purgeAfter(deletedAt).toISOString(),
    };
  }
}
