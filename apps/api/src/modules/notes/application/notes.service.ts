import type {
  CreateNoteInput,
  EntityNotesView,
  MediaView,
  NoteCategory,
  NotesQuery,
  NotesSummaryView,
  NoteView,
  Nullable,
  Paginator,
  UpdateNoteInput,
} from "@app/shared";

import { normalizeSearch, NOTE_ERROR_CODES, NoteCategorySchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { MediaAssetModel } from "../../../generated/prisma/models.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { buildPaginator } from "../../../core/paginator.js";
import { BooksRepository } from "../../books/index.js";
import { MediaService } from "../../media/index.js";
import { SeriesService } from "../../series/index.js";
import { emptyToNull, resolveCustomCategory } from "../domain/note-fields.js";
import { buildNotesSummary } from "../domain/note-summary.js";
import { type NoteEntityCovers, toNoteView } from "../domain/note.mapper.js";
import {
  NotesRepository,
  type NoteWithEntity,
  type UpdateNoteFields,
} from "../infrastructure/notes.repository.js";

const log = createLogger("notes.view");

@Injectable()
export class NotesService {
  constructor(
    private readonly notesRepository: NotesRepository,
    private readonly booksRepository: BooksRepository,
    private readonly seriesService: SeriesService,
    private readonly mediaService: MediaService,
  ) {}

  async createBookNote(userId: string, bookId: string, input: CreateNoteInput): Promise<NoteView> {
    await this.assertBookOwned(userId, bookId);
    const category = input.category ?? null;

    const created = await this.notesRepository.create({
      bookId,
      category,
      chapter: emptyToNull(input.chapter),
      customCategory: resolveCustomCategory({ category, customCategory: input.customCategory }),
      entityType: "book",
      isFavorite: input.isFavorite,
      isPinned: input.isPinned,
      isSpoiler: input.isSpoiler,
      page: input.page ?? null,
      seriesId: null,
      text: input.text,
      userId,
    });

    return this.toView(created);
  }

  async createSeriesNote(
    userId: string,
    seriesId: string,
    input: CreateNoteInput,
  ): Promise<NoteView> {
    await this.assertSeriesOwned(userId, seriesId);
    const category = input.category ?? null;

    const created = await this.notesRepository.create({
      bookId: null,
      category,
      chapter: emptyToNull(input.chapter),
      customCategory: resolveCustomCategory({ category, customCategory: input.customCategory }),
      entityType: "series",
      isFavorite: input.isFavorite,
      isPinned: input.isPinned,
      isSpoiler: input.isSpoiler,
      page: input.page ?? null,
      seriesId,
      text: input.text,
      userId,
    });

    return this.toView(created);
  }

  async delete(userId: string, noteId: string): Promise<void> {
    const deleted = await this.notesRepository.deleteOwned(userId, noteId);
    if (deleted === 0) {
      throw new NotFoundError("Note not found", { code: NOTE_ERROR_CODES.noteNotFound });
    }
  }

  async editNote(userId: string, noteId: string, input: UpdateNoteInput): Promise<NoteView> {
    const current = await this.notesRepository.findOwnedById(userId, noteId);
    if (current === null) {
      throw new NotFoundError("Note not found", { code: NOTE_ERROR_CODES.noteNotFound });
    }

    const fields = this.buildUpdateFields(current, input);
    const updated = await this.notesRepository.update({ fields, noteId, userId });
    return this.toView(updated);
  }

  async listBookNotes(userId: string, bookId: string): Promise<EntityNotesView> {
    await this.assertBookOwned(userId, bookId);
    const notes = await this.notesRepository.listByBook(userId, bookId);
    return { notes: notes.map((note) => this.toView(note)), totalCount: notes.length };
  }

  async listGlobal(userId: string, query: NotesQuery): Promise<Paginator<NoteView>> {
    const filter = {
      bookId: query.bookId,
      category: query.category,
      customCategory: query.customCategory,
      entityType: query.entityType,
      filter: query.filter,
      hasChapter: query.hasChapter,
      hasPage: query.hasPage,
      search: normalizeSearch(query.search),
      seriesId: query.seriesId,
      userId,
    };

    const [items, totalCount] = await Promise.all([
      this.notesRepository.listNotes({
        ...filter,
        skip: (query.pageNumber - 1) * query.pageSize,
        sort: query.sort,
        take: query.pageSize,
      }),
      this.notesRepository.countNotes(filter),
    ]);

    return buildPaginator({
      items: items.map((note) => this.toView(note)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async listSeriesNotes(userId: string, seriesId: string): Promise<EntityNotesView> {
    await this.assertSeriesOwned(userId, seriesId);
    const notes = await this.notesRepository.listBySeries(userId, seriesId);
    return { notes: notes.map((note) => this.toView(note)), totalCount: notes.length };
  }

  async summary(userId: string): Promise<NotesSummaryView> {
    const counts = await this.notesRepository.summaryCounts(userId);
    return buildNotesSummary(counts);
  }

  private async assertBookOwned(userId: string, bookId: string): Promise<void> {
    const owned = await this.booksRepository.existsOwned({ bookId, userId });
    if (!owned) {
      throw new NotFoundError("Book not found", { code: NOTE_ERROR_CODES.bookNotFound });
    }
  }

  private async assertSeriesOwned(userId: string, seriesId: string): Promise<void> {
    const owned = await this.seriesService.existsOwned({ seriesId, userId });
    if (!owned) {
      throw new NotFoundError("Series not found", { code: NOTE_ERROR_CODES.seriesNotFound });
    }
  }

  private buildUpdateFields(current: NoteWithEntity, input: UpdateNoteInput): UpdateNoteFields {
    const fields: UpdateNoteFields = {};

    if (input.text !== undefined) {
      fields.text = input.text;
    }
    if (input.isFavorite !== undefined) {
      fields.isFavorite = input.isFavorite;
    }
    if (input.isPinned !== undefined) {
      fields.isPinned = input.isPinned;
    }
    if (input.isSpoiler !== undefined) {
      fields.isSpoiler = input.isSpoiler;
    }
    if (input.page !== undefined) {
      fields.page = input.page;
    }
    if (input.chapter !== undefined) {
      fields.chapter = emptyToNull(input.chapter);
    }

    if (input.category !== undefined || input.customCategory !== undefined) {
      const category =
        input.category !== undefined ? input.category : parseCategory(current.category);
      const customCategory =
        input.customCategory !== undefined ? input.customCategory : current.customCategory;

      if (input.category !== undefined) {
        fields.category = input.category;
      }
      fields.customCategory = resolveCustomCategory({ category, customCategory });
    }

    return fields;
  }

  private coverViewOf(coverMedia: Nullable<MediaAssetModel>): Nullable<MediaView> {
    if (coverMedia === null) {
      return null;
    }
    try {
      return this.mediaService.buildView(coverMedia);
    } catch (error) {
      log.warn({ err: error, mediaId: coverMedia.id }, "failed to build note cover view");
      return null;
    }
  }

  private toView(note: NoteWithEntity): NoteView {
    const covers: NoteEntityCovers = {
      book: this.coverViewOf(note.book?.coverMedia ?? null),
      series: this.coverViewOf(note.series?.books[0]?.coverMedia ?? null),
    };
    return toNoteView(note, covers);
  }
}

function parseCategory(value: Nullable<string>): Nullable<NoteCategory> {
  return value === null ? null : NoteCategorySchema.parse(value);
}
