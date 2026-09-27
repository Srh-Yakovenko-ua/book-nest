import type {
  BookNotesQuery,
  CreateNoteInput,
  CreateSeriesNoteInput,
  EntityNotesView,
  NoteCategory,
  NoteView,
  Nullable,
  Paginator,
  SeriesNotesQuery,
  UpdateNoteInput,
} from "@app/shared";

import { NOTE_ERROR_CODES, NoteCategorySchema, NoteEntityTypeSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { BookAccessService } from "../../books/index.js";
import { MediaService } from "../../media/index.js";
import { SeriesService } from "../../series/index.js";
import { emptyToNull, resolveCustomCategory, touchesNoteContent } from "../domain/note-fields.js";
import { resolveNoteEntityCovers, toNoteView } from "../domain/note.mapper.js";
import {
  NotesRepository,
  type NoteWithEntity,
  type UpdateNoteFields,
} from "../infrastructure/notes.repository.js";
import { toBookNotesDataset, toSeriesNotesDataset } from "./note-archive-dataset.js";

@Injectable()
export class NotesService {
  constructor(
    private readonly notesRepository: NotesRepository,
    private readonly bookAccess: BookAccessService,
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
    input: CreateSeriesNoteInput,
  ): Promise<NoteView> {
    await this.assertSeriesOwned(userId, seriesId);
    const category = input.category ?? null;

    const created = await this.notesRepository.create({
      bookId: null,
      category,
      chapter: null,
      customCategory: resolveCustomCategory({ category, customCategory: input.customCategory }),
      entityType: "series",
      isFavorite: input.isFavorite,
      isPinned: input.isPinned,
      isSpoiler: input.isSpoiler,
      page: null,
      seriesId,
      text: input.text,
      userId,
    });

    return this.toView(created);
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

  async listBookArchive({
    query,
    userId,
  }: {
    query: BookNotesQuery;
    userId: string;
  }): Promise<Paginator<NoteView>> {
    const selection = { dataset: toBookNotesDataset({ query, userId }), quickFilter: query.filter };

    const [items, totalCount] = await Promise.all([
      this.notesRepository.listBookArchive({
        ...selection,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.notesRepository.countBookArchive(selection),
    ]);

    return this.toPaginator({ items, query, totalCount });
  }

  async listBookNotes(userId: string, bookId: string): Promise<EntityNotesView> {
    await this.assertBookOwned(userId, bookId);
    const notes = await this.notesRepository.listByBook(userId, bookId);
    return { notes: notes.map((note) => this.toView(note)), totalCount: notes.length };
  }

  async listSeriesArchive({
    query,
    userId,
  }: {
    query: SeriesNotesQuery;
    userId: string;
  }): Promise<Paginator<NoteView>> {
    const selection = {
      dataset: toSeriesNotesDataset({ query, userId }),
      quickFilter: query.filter,
    };

    const [items, totalCount] = await Promise.all([
      this.notesRepository.listSeriesArchive({
        ...selection,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.notesRepository.countSeriesArchive(selection),
    ]);

    return this.toPaginator({ items, query, totalCount });
  }

  async listSeriesNotes(userId: string, seriesId: string): Promise<EntityNotesView> {
    await this.assertSeriesOwned(userId, seriesId);
    const notes = await this.notesRepository.listBySeries(userId, seriesId);
    return { notes: notes.map((note) => this.toView(note)), totalCount: notes.length };
  }

  private async assertBookOwned(userId: string, bookId: string): Promise<void> {
    await this.bookAccess.assertOwned({
      bookId,
      notFoundCode: NOTE_ERROR_CODES.bookNotFound,
      userId,
    });
  }

  private async assertSeriesOwned(userId: string, seriesId: string): Promise<void> {
    const owned = await this.seriesService.existsOwned({ seriesId, userId });
    if (!owned) {
      throw new NotFoundError("Series not found", { code: NOTE_ERROR_CODES.seriesNotFound });
    }
  }

  private buildUpdateFields(current: NoteWithEntity, input: UpdateNoteInput): UpdateNoteFields {
    if (current.entityType === NoteEntityTypeSchema.enum.series) {
      assertNoSeriesNoteLocation(input);
    }

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

    if (!touchesNoteContent(input)) {
      fields.updatedAt = current.updatedAt;
    }

    return fields;
  }

  private toPaginator({
    items,
    query,
    totalCount,
  }: {
    items: NoteWithEntity[];
    query: { pageNumber: number; pageSize: number };
    totalCount: number;
  }): Paginator<NoteView> {
    return buildPaginator({
      items: items.map((note) => this.toView(note)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  private toView(note: NoteWithEntity): NoteView {
    const covers = resolveNoteEntityCovers({
      buildCover: (asset) => this.mediaService.buildViewOrNull(asset),
      note,
    });
    return toNoteView(note, covers);
  }
}

function assertNoSeriesNoteLocation(input: UpdateNoteInput): void {
  const addsPage = input.page !== undefined && input.page !== null;
  const addsChapter = input.chapter !== undefined && emptyToNull(input.chapter) !== null;
  if (addsPage || addsChapter) {
    throw new BadRequestError("Series notes cannot have a page or chapter", {
      code: NOTE_ERROR_CODES.seriesNoteLocationUnsupported,
    });
  }
}

function parseCategory(value: Nullable<string>): Nullable<NoteCategory> {
  return value === null ? null : NoteCategorySchema.parse(value);
}
