import type {
  NoteMemoryBookSource,
  NoteMemoryView,
  NoteRediscoveryImpressionInput,
  Nullable,
} from "@app/shared";

import { Injectable } from "@nestjs/common";

import type {
  NoteRediscoveryCandidate,
  NoteRediscoveryScope,
  NoteSourceRef,
} from "../domain/note-rediscovery.js";
import type {
  MemoryBookSourceRow,
  NoteLastShownRow,
} from "../infrastructure/note-rediscovery.repository.js";

import { assertNever } from "../../../core/assert-never.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { parseIsoDate, toIsoDate, toZonedIsoDate } from "../../../core/iso-date.js";
import { REDISCOVERY_POLICY, rediscoveryCreationCutoff } from "../../../core/rediscovery.js";
import { MediaService } from "../../media/index.js";
import { UserSettingsContextService } from "../../profile/index.js";
import {
  BOOKS_REDISCOVERY_SCOPE,
  decodeNoteImpressionKey,
  encodeNoteImpressionKey,
  NOTE_REDISCOVERY_SURFACE,
  noteSourceKeyOf,
  parseSeriesContextKey,
  selectMemoryNoteId,
  seriesRediscoveryScope,
} from "../domain/note-rediscovery.js";
import { resolveNoteEntityCovers, toNoteView } from "../domain/note.mapper.js";
import { NoteRediscoveryRepository } from "../infrastructure/note-rediscovery.repository.js";
import { NotesRepository, type NoteWithEntity } from "../infrastructure/notes.repository.js";

const NOTE_NOT_REDISCOVERABLE_MESSAGE = "Note is not available for rediscovery";

type CandidateSourceRow = {
  createdAt: Date;
  id: string;
  isFavorite: boolean;
  isPinned: boolean;
  source: NoteSourceRef;
};

type LocalDay = {
  localDate: string;
  timeZone: string;
};

type MemorySelection = {
  candidateRows: CandidateSourceRow[];
  lastSourceKey: Nullable<string>;
  localDay: LocalDay;
  scope: NoteRediscoveryScope;
  userId: string;
};

@Injectable()
export class NoteRediscoveryService {
  constructor(
    private readonly mediaService: MediaService,
    private readonly notesRepository: NotesRepository,
    private readonly rediscoveryRepository: NoteRediscoveryRepository,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async listSeriesIdsWithMemoryPool({
    seriesIds,
    userId,
  }: {
    seriesIds: string[];
    userId: string;
  }): Promise<ReadonlySet<string>> {
    if (seriesIds.length === 0) {
      return new Set();
    }

    const localDay = await this.resolveLocalDay({ now: new Date(), userId });
    const poolSizes = await this.rediscoveryRepository.countEligibleSeriesPoolNotes({
      createdBefore: rediscoveryCreationCutoff(localDay),
      seriesIds,
      userId,
    });
    return new Set(
      [...poolSizes]
        .filter(([, poolSize]) => poolSize >= REDISCOVERY_POLICY.minimumCandidates)
        .map(([seriesId]) => seriesId),
    );
  }

  async recordImpression({
    input,
    userId,
  }: {
    input: NoteRediscoveryImpressionInput;
    userId: string;
  }): Promise<void> {
    const target = decodeNoteImpressionKey(input.impressionKey);
    if (target === null) {
      throw new NotFoundError(NOTE_NOT_REDISCOVERABLE_MESSAGE);
    }

    switch (target.surface) {
      case NOTE_REDISCOVERY_SURFACE.books:
        await this.recordBooksImpression({
          contextKey: target.contextKey,
          noteId: target.noteId,
          userId,
        });
        return;
      case NOTE_REDISCOVERY_SURFACE.series:
        await this.recordSeriesImpression({
          contextKey: target.contextKey,
          noteId: target.noteId,
          userId,
        });
        return;
      default:
        assertNever(target.surface);
    }
  }

  async selectBooksMemoryNote({ userId }: { userId: string }): Promise<Nullable<NoteMemoryView>> {
    const localDay = await this.resolveLocalDay({ now: new Date(), userId });
    const candidateRows = await this.rediscoveryRepository.listEligibleBookNotes({
      createdBefore: rediscoveryCreationCutoff(localDay),
      userId,
    });

    const noteId = await this.selectNoteId({
      candidateRows: candidateRows.map((row) => ({
        ...row,
        source: { id: row.bookId, type: "book" },
      })),
      lastSourceKey: null,
      localDay,
      scope: BOOKS_REDISCOVERY_SCOPE,
      userId,
    });
    if (noteId === null) {
      return null;
    }

    return this.hydrateMemory({ noteId, scope: BOOKS_REDISCOVERY_SCOPE, userId });
  }

  async selectSeriesMemoryNote({
    seriesId,
    userId,
  }: {
    seriesId: string;
    userId: string;
  }): Promise<Nullable<NoteMemoryView>> {
    const scope = seriesRediscoveryScope(seriesId);
    const localDay = await this.resolveLocalDay({ now: new Date(), userId });
    const [candidateRows, lastSourceKey] = await Promise.all([
      this.rediscoveryRepository.listEligibleSeriesPoolNotes({
        createdBefore: rediscoveryCreationCutoff(localDay),
        seriesId,
        userId,
      }),
      this.rediscoveryRepository.findLastSourceKey({ ...scope, userId }),
    ]);

    const noteId = await this.selectNoteId({
      candidateRows,
      lastSourceKey,
      localDay,
      scope,
      userId,
    });
    if (noteId === null) {
      return null;
    }

    return this.hydrateMemory({ noteId, scope, userId });
  }

  private async hydrateMemory({
    noteId,
    scope,
    userId,
  }: {
    noteId: string;
    scope: NoteRediscoveryScope;
    userId: string;
  }): Promise<Nullable<NoteMemoryView>> {
    const note = await this.notesRepository.findOwnedById(userId, noteId);
    if (note === null) {
      return null;
    }

    const source = await this.resolveMemorySource({ note, userId });
    if (source === null) {
      return null;
    }

    return {
      impressionKey: encodeNoteImpressionKey({ ...scope, noteId: note.id }),
      note: this.toView(note),
      source,
    };
  }

  private async recordBooksImpression({
    contextKey,
    noteId,
    userId,
  }: {
    contextKey: string;
    noteId: string;
    userId: string;
  }): Promise<void> {
    if (contextKey !== BOOKS_REDISCOVERY_SCOPE.contextKey) {
      throw new NotFoundError(NOTE_NOT_REDISCOVERABLE_MESSAGE);
    }

    const now = new Date();
    const localDay = await this.resolveLocalDay({ now, userId });
    const note = await this.rediscoveryRepository.findEligibleBookNote({
      createdBefore: rediscoveryCreationCutoff(localDay),
      noteId,
      userId,
    });
    if (note === null) {
      throw new NotFoundError(NOTE_NOT_REDISCOVERABLE_MESSAGE);
    }

    await this.rediscoveryRepository.recordImpression({
      ...BOOKS_REDISCOVERY_SCOPE,
      noteId: note.id,
      shownAt: now,
      shownOn: parseIsoDate(localDay.localDate),
      sourceKey: noteSourceKeyOf({ id: note.bookId, type: "book" }),
      userId,
    });
  }

  private async recordSeriesImpression({
    contextKey,
    noteId,
    userId,
  }: {
    contextKey: string;
    noteId: string;
    userId: string;
  }): Promise<void> {
    const seriesId = parseSeriesContextKey(contextKey);
    if (seriesId === null) {
      throw new NotFoundError(NOTE_NOT_REDISCOVERABLE_MESSAGE);
    }

    const now = new Date();
    const localDay = await this.resolveLocalDay({ now, userId });
    const note = await this.rediscoveryRepository.findEligibleSeriesPoolNote({
      createdBefore: rediscoveryCreationCutoff(localDay),
      noteId,
      seriesId,
      userId,
    });
    if (note === null) {
      throw new NotFoundError(NOTE_NOT_REDISCOVERABLE_MESSAGE);
    }

    await this.rediscoveryRepository.recordImpression({
      ...seriesRediscoveryScope(seriesId),
      noteId: note.id,
      shownAt: now,
      shownOn: parseIsoDate(localDay.localDate),
      sourceKey: noteSourceKeyOf(note.source),
      userId,
    });
  }

  private async resolveLocalDay({ now, userId }: { now: Date; userId: string }): Promise<LocalDay> {
    const { timezone } = await this.userSettingsContextService.resolve(userId);
    return { localDate: toZonedIsoDate({ instant: now, timeZone: timezone }), timeZone: timezone };
  }

  private async resolveMemorySource({
    note,
    userId,
  }: {
    note: NoteWithEntity;
    userId: string;
  }): Promise<Nullable<NoteMemoryView["source"]>> {
    if (note.series !== null) {
      return { id: note.series.id, title: note.series.name, type: "series" };
    }
    if (note.bookId === null) {
      return null;
    }

    const book = await this.rediscoveryRepository.findMemoryBookSource({
      bookId: note.bookId,
      userId,
    });
    return book === null ? null : this.toBookSource(book);
  }

  private async selectNoteId({
    candidateRows,
    lastSourceKey,
    localDay,
    scope,
    userId,
  }: MemorySelection): Promise<Nullable<string>> {
    if (candidateRows.length < REDISCOVERY_POLICY.minimumCandidates) {
      return null;
    }

    const today = parseIsoDate(localDay.localDate);
    const [lastShownRows, todaysImpressions] = await Promise.all([
      this.rediscoveryRepository.listLastShownDatesBefore({
        noteIds: candidateRows.map((row) => row.id),
        shownBefore: today,
        userId,
      }),
      this.rediscoveryRepository.listImpressionsOn({ ...scope, shownOn: today, userId }),
    ]);

    const candidates = toCandidates({ candidateRows, lastShownRows, timeZone: localDay.timeZone });
    const eligibleIds = new Set(candidates.map((candidate) => candidate.id));
    const reused = todaysImpressions.find((impression) => eligibleIds.has(impression.noteId));
    if (reused !== undefined) {
      return reused.noteId;
    }

    return selectMemoryNoteId({
      candidates,
      lastSourceKey,
      localDate: localDay.localDate,
      scope,
      userId,
    });
  }

  private toBookSource(book: MemoryBookSourceRow): NoteMemoryBookSource {
    return {
      authors: book.authors.map((bookAuthor) => bookAuthor.author),
      cover: this.mediaService.buildViewOrNull(book.coverMedia),
      id: book.id,
      seriesPosition:
        book.series === null || book.series.deletedAt !== null ? null : book.partNumber,
      title: book.title,
      type: "book",
    };
  }

  private toView(note: NoteWithEntity): NoteMemoryView["note"] {
    return toNoteView(
      note,
      resolveNoteEntityCovers({
        buildCover: (asset) => this.mediaService.buildViewOrNull(asset),
        note,
      }),
    );
  }
}

function toCandidates({
  candidateRows,
  lastShownRows,
  timeZone,
}: {
  candidateRows: CandidateSourceRow[];
  lastShownRows: NoteLastShownRow[];
  timeZone: string;
}): NoteRediscoveryCandidate[] {
  const lastShownByNoteId = new Map(
    lastShownRows.map((row) => [row.noteId, toIsoDate(row.lastShownOn)]),
  );

  return candidateRows.map((row) => ({
    createdOn: toZonedIsoDate({ instant: row.createdAt, timeZone }),
    id: row.id,
    isFavorite: row.isFavorite,
    isPinned: row.isPinned,
    lastShownOn: lastShownByNoteId.get(row.id) ?? null,
    sourceKey: noteSourceKeyOf(row.source),
  }));
}
