import type {
  Nullable,
  ReadingStatus,
  SeriesBeforeNextBookNote,
  SeriesBeforeNextBookView,
} from "@app/shared";

import { OwnershipStatusSchema, ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  BeforeContinuationPlan,
  OverviewSeriesCandidate,
  SeriesShapeBook,
} from "../domain/series-before-continuation.js";
import type {
  ContinuationBookRow,
  NoteActivityRow,
  SeriesShapeRow,
} from "../infrastructure/series-before-continuation.repository.js";

import { MediaService } from "../../media/index.js";
import { resolveContinuationReason, toContinuationProgress } from "../../series/index.js";
import { resolveNoteEntityCovers, toNoteView } from "../domain/note.mapper.js";
import {
  continuationReadingStatusOf,
  latestActivityOf,
  pickOverviewSeries,
  planBeforeContinuation,
  rankRecapNotes,
  SERIES_BEFORE_CONTINUATION_POLICY,
} from "../domain/series-before-continuation.js";
import { NotesRepository, type NoteWithEntity } from "../infrastructure/notes.repository.js";
import { SeriesBeforeContinuationRepository } from "../infrastructure/series-before-continuation.repository.js";
import { NoteRediscoveryService } from "./note-rediscovery.service.js";

export type SeriesOverviewContext = {
  beforeNextBook: Nullable<SeriesBeforeNextBookView>;
  seriesId: Nullable<string>;
};

type PlannedSeries = {
  continuationReadingStatus: Nullable<ReadingStatus>;
  plan: Nullable<BeforeContinuationPlan>;
  shape: SeriesShapeRow;
};

const NO_SERIES_CONTEXT: SeriesOverviewContext = { beforeNextBook: null, seriesId: null };

@Injectable()
export class SeriesBeforeContinuationService {
  constructor(
    private readonly mediaService: MediaService,
    private readonly notesRepository: NotesRepository,
    private readonly rediscoveryService: NoteRediscoveryService,
    private readonly repository: SeriesBeforeContinuationRepository,
  ) {}

  async resolveOverviewContext({
    selectedSeriesIds,
    userId,
  }: {
    selectedSeriesIds: readonly string[];
    userId: string;
  }): Promise<SeriesOverviewContext> {
    const selection = [...new Set(selectedSeriesIds)];
    const shapes = await this.repository.listSeriesShapes({
      seriesIds: selection.length === 0 ? null : selection,
      userId,
    });
    if (shapes.length === 0) {
      return NO_SERIES_CONTEXT;
    }

    const seriesIds = shapes.map((shape) => shape.id);
    const [bookNoteActivity, seriesNoteActivity] = await Promise.all([
      this.repository.listBookNoteActivity({ seriesIds, userId }),
      this.repository.listSeriesNoteActivity({ seriesIds, userId }),
    ]);
    const notedBookIds = new Set(bookNoteActivity.map((row) => row.entityId));
    const planned: PlannedSeries[] = shapes.map((shape) => {
      const books = shape.books.map(toShapeBook);
      return {
        continuationReadingStatus: continuationReadingStatusOf(books),
        plan: planBeforeContinuation({ books, notedBookIds }),
        shape,
      };
    });

    const chosen =
      selection.length === 1
        ? (planned[0] ?? null)
        : await this.pickOverviewCandidate({
            bookNoteActivity,
            planned,
            seriesNoteActivity,
            userId,
          });
    if (chosen === null) {
      return NO_SERIES_CONTEXT;
    }

    const beforeNextBook =
      chosen.plan === null
        ? null
        : await this.buildBeforeNextBook({ plan: chosen.plan, shape: chosen.shape, userId });
    return { beforeNextBook, seriesId: chosen.shape.id };
  }

  private async buildBeforeNextBook({
    plan,
    shape,
    userId,
  }: {
    plan: BeforeContinuationPlan;
    shape: SeriesShapeRow;
    userId: string;
  }): Promise<Nullable<SeriesBeforeNextBookView>> {
    const [continuation, recapRows] = await Promise.all([
      this.repository.findContinuationBook({ bookId: plan.continuationBookId, userId }),
      this.repository.listRecapNotes({ bookIds: [...plan.distanceByBookId.keys()], userId }),
    ]);
    const ranked = rankRecapNotes({ distanceByBookId: plan.distanceByBookId, notes: recapRows });
    if (continuation === null || ranked.length === 0) {
      return null;
    }

    const previewIds = ranked
      .slice(0, SERIES_BEFORE_CONTINUATION_POLICY.previewLimit)
      .map((note) => note.id);
    const previewNotes = await this.notesRepository.listActiveByIds({
      noteIds: previewIds,
      userId,
    });

    return {
      continuation: this.toContinuationView(continuation),
      notes: this.toRecapNotes({ previewIds, previewNotes, shape }),
      previewLimit: SERIES_BEFORE_CONTINUATION_POLICY.previewLimit,
      series: {
        id: shape.id,
        knownBooksCount: shape.books.length,
        title: shape.name,
        totalBooks: shape.totalBooks,
      },
      totalCount: ranked.length,
    };
  }

  private async pickOverviewCandidate({
    bookNoteActivity,
    planned,
    seriesNoteActivity,
    userId,
  }: {
    bookNoteActivity: NoteActivityRow[];
    planned: PlannedSeries[];
    seriesNoteActivity: NoteActivityRow[];
    userId: string;
  }): Promise<Nullable<PlannedSeries>> {
    const continuing = planned.filter((entry) => entry.continuationReadingStatus !== null);
    const hasAnyPlan = continuing.some((entry) => entry.plan !== null);
    const memorySeriesIds = hasAnyPlan
      ? new Set<string>()
      : await this.rediscoveryService.listSeriesIdsWithMemoryPool({
          seriesIds: continuing.map((entry) => entry.shape.id),
          userId,
        });

    return pickPlannedSeries({
      bookNoteActivity,
      planned: continuing.filter(
        (entry) => entry.plan !== null || memorySeriesIds.has(entry.shape.id),
      ),
      seriesNoteActivity,
    });
  }

  private toContinuationView(book: ContinuationBookRow): SeriesBeforeNextBookView["continuation"] {
    const ownershipStatus = OwnershipStatusSchema.parse(book.ownershipStatus);
    const readingStatus = ReadingStatusSchema.parse(book.readingStatus);
    return {
      authors: book.authors.map((bookAuthor) => bookAuthor.author),
      cover: this.mediaService.buildViewOrNull(book.coverMedia),
      id: book.id,
      ownershipStatus,
      progress: toContinuationProgress({
        currentPage: book.readingProgress?.currentPage ?? null,
        pagesCount: book.pagesCount,
      }),
      readingStatus,
      reason: resolveContinuationReason({ ownershipStatus, readingStatus }),
      seriesPosition: book.partNumber,
      title: book.title,
    };
  }

  private toRecapNotes({
    previewIds,
    previewNotes,
    shape,
  }: {
    previewIds: string[];
    previewNotes: NoteWithEntity[];
    shape: SeriesShapeRow;
  }): SeriesBeforeNextBookNote[] {
    const noteById = new Map(previewNotes.map((note) => [note.id, note]));
    const bookById = new Map(shape.books.map((book) => [book.id, book]));

    return previewIds.flatMap((noteId) => {
      const note = noteById.get(noteId);
      if (note === undefined || note.bookId === null) {
        return [];
      }
      const sourceBook = bookById.get(note.bookId);
      if (sourceBook === undefined) {
        return [];
      }

      const covers = resolveNoteEntityCovers({
        buildCover: (asset) => this.mediaService.buildViewOrNull(asset),
        note,
      });
      return [
        {
          ...toNoteView(note, covers),
          sourceBook: {
            id: sourceBook.id,
            seriesPosition: sourceBook.partNumber,
            title: sourceBook.title,
          },
        },
      ];
    });
  }
}

function activityById(rows: NoteActivityRow[]): Map<string, Date> {
  return new Map(rows.map((row) => [row.entityId, row.lastUpdatedAt]));
}

function pickPlannedSeries({
  bookNoteActivity,
  planned,
  seriesNoteActivity,
}: {
  bookNoteActivity: NoteActivityRow[];
  planned: PlannedSeries[];
  seriesNoteActivity: NoteActivityRow[];
}): Nullable<PlannedSeries> {
  const bookNoteActivityById = activityById(bookNoteActivity);
  const seriesNoteActivityById = activityById(seriesNoteActivity);
  const plannedById = new Map(planned.map((entry) => [entry.shape.id, entry]));

  const candidates = planned.flatMap(
    ({ continuationReadingStatus, plan, shape }): OverviewSeriesCandidate[] =>
      continuationReadingStatus === null
        ? []
        : [
            {
              continuationReadingStatus,
              hasBeforeContinuationPlan: plan !== null,
              lastActivityAt: latestActivityOf([
                seriesNoteActivityById.get(shape.id) ?? null,
                ...shape.books.flatMap((book) => [
                  book.readingCycles[0]?.updatedAt ?? null,
                  book.readingProgress?.updatedAt ?? null,
                  bookNoteActivityById.get(book.id) ?? null,
                ]),
              ]),
              seriesId: shape.id,
            },
          ],
  );

  const best = pickOverviewSeries(candidates);
  return best === null ? null : (plannedById.get(best.seriesId) ?? null);
}

function toShapeBook(book: SeriesShapeRow["books"][number]): SeriesShapeBook {
  return {
    createdAt: book.createdAt,
    id: book.id,
    partNumber: book.partNumber,
    readingStatus: ReadingStatusSchema.parse(book.readingStatus),
  };
}
