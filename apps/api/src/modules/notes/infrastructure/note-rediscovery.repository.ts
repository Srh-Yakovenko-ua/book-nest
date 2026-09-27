import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { NoteRediscoveryScope, NoteSourceRef } from "../domain/note-rediscovery.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

const bookNoteCandidateSelect = {
  bookId: true,
  createdAt: true,
  id: true,
  isFavorite: true,
  isPinned: true,
} satisfies Prisma.NoteSelect;

const seriesPoolCandidateSelect = {
  bookId: true,
  createdAt: true,
  entityType: true,
  id: true,
  isFavorite: true,
  isPinned: true,
  seriesId: true,
} satisfies Prisma.NoteSelect;

const memoryBookSourceSelect = {
  authors: {
    orderBy: { position: "asc" },
    select: { author: { select: { id: true, name: true } } },
  },
  coverMedia: true,
  id: true,
  partNumber: true,
  series: { select: { deletedAt: true } },
  title: true,
} satisfies Prisma.BookSelect;

export type BookNoteCandidateRow = {
  bookId: string;
  createdAt: Date;
  id: string;
  isFavorite: boolean;
  isPinned: boolean;
};

export type MemoryBookSourceRow = Prisma.BookGetPayload<{
  select: typeof memoryBookSourceSelect;
}>;

export type NoteImpressionRow = {
  noteId: string;
  sourceKey: string;
};

export type NoteLastShownRow = {
  lastShownOn: Date;
  noteId: string;
};

export type SeriesPoolCandidateRow = {
  createdAt: Date;
  id: string;
  isFavorite: boolean;
  isPinned: boolean;
  source: NoteSourceRef;
};

type ImpressionRecord = NoteRediscoveryScope & {
  noteId: string;
  shownAt: Date;
  shownOn: Date;
  sourceKey: string;
  userId: string;
};

@Injectable()
export class NoteRediscoveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countEligibleSeriesPoolNotes({
    createdBefore,
    seriesIds,
    userId,
  }: {
    createdBefore: Date;
    seriesIds: string[];
    userId: string;
  }): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (seriesIds.length === 0) {
      return counts;
    }

    const base = buildEligiblePoolNoteWhere({ createdBefore, userId });
    const [seriesNoteGroups, bookNoteGroups] = await Promise.all([
      this.prisma.note.groupBy({
        _count: { _all: true },
        by: ["seriesId"],
        where: { ...base, ...buildPoolSeriesNoteWhere(seriesIds) },
      }),
      this.prisma.note.groupBy({
        _count: { _all: true },
        by: ["bookId"],
        where: { ...base, ...buildPoolBookNoteWhere(seriesIds) },
      }),
    ]);
    const notedBookIds = bookNoteGroups.flatMap((group) =>
      group.bookId === null ? [] : [group.bookId],
    );
    const books =
      notedBookIds.length === 0
        ? []
        : await this.prisma.book.findMany({
            select: { id: true, seriesId: true },
            where: { id: { in: notedBookIds }, userId },
          });
    const seriesIdByBookId = new Map(books.map((book) => [book.id, book.seriesId]));

    const addCount = ({ count, seriesId }: { count: number; seriesId: Nullable<string> }): void => {
      if (seriesId !== null) {
        counts.set(seriesId, (counts.get(seriesId) ?? 0) + count);
      }
    };
    for (const group of seriesNoteGroups) {
      addCount({ count: group._count._all, seriesId: group.seriesId });
    }
    for (const group of bookNoteGroups) {
      const seriesId = group.bookId === null ? null : (seriesIdByBookId.get(group.bookId) ?? null);
      addCount({ count: group._count._all, seriesId });
    }
    return counts;
  }

  async findEligibleBookNote({
    createdBefore,
    noteId,
    userId,
  }: {
    createdBefore: Date;
    noteId: string;
    userId: string;
  }): Promise<Nullable<BookNoteCandidateRow>> {
    const row = await this.prisma.note.findFirst({
      select: bookNoteCandidateSelect,
      where: { ...buildEligibleBookNoteWhere({ createdBefore, userId }), id: noteId },
    });
    return row === null ? null : toBookNoteCandidateRow(row);
  }

  async findEligibleSeriesPoolNote({
    createdBefore,
    noteId,
    seriesId,
    userId,
  }: {
    createdBefore: Date;
    noteId: string;
    seriesId: string;
    userId: string;
  }): Promise<Nullable<SeriesPoolCandidateRow>> {
    const row = await this.prisma.note.findFirst({
      select: seriesPoolCandidateSelect,
      where: { ...buildEligibleSeriesPoolWhere({ createdBefore, seriesId, userId }), id: noteId },
    });
    return row === null ? null : toSeriesPoolCandidateRow(row);
  }

  async findLastSourceKey({
    contextKey,
    surface,
    userId,
  }: NoteRediscoveryScope & { userId: string }): Promise<Nullable<string>> {
    const latest = await this.prisma.noteRediscoveryImpression.findFirst({
      orderBy: [{ shownAt: "desc" }, { id: "asc" }],
      select: { sourceKey: true },
      where: { contextKey, surface, userId },
    });
    return latest?.sourceKey ?? null;
  }

  findMemoryBookSource({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<Nullable<MemoryBookSourceRow>> {
    return this.prisma.book.findFirst({
      select: memoryBookSourceSelect,
      where: { ...SOFT_DELETE_SCOPE.active, id: bookId, userId },
    });
  }

  async listEligibleBookNotes({
    createdBefore,
    userId,
  }: {
    createdBefore: Date;
    userId: string;
  }): Promise<BookNoteCandidateRow[]> {
    const rows = await this.prisma.note.findMany({
      orderBy: { id: "asc" },
      select: bookNoteCandidateSelect,
      where: buildEligibleBookNoteWhere({ createdBefore, userId }),
    });
    return rows.flatMap((row) => {
      const candidate = toBookNoteCandidateRow(row);
      return candidate === null ? [] : [candidate];
    });
  }

  async listEligibleSeriesPoolNotes({
    createdBefore,
    seriesId,
    userId,
  }: {
    createdBefore: Date;
    seriesId: string;
    userId: string;
  }): Promise<SeriesPoolCandidateRow[]> {
    const rows = await this.prisma.note.findMany({
      orderBy: { id: "asc" },
      select: seriesPoolCandidateSelect,
      where: buildEligibleSeriesPoolWhere({ createdBefore, seriesId, userId }),
    });
    return rows.flatMap((row) => {
      const candidate = toSeriesPoolCandidateRow(row);
      return candidate === null ? [] : [candidate];
    });
  }

  listImpressionsOn({
    contextKey,
    shownOn,
    surface,
    userId,
  }: NoteRediscoveryScope & { shownOn: Date; userId: string }): Promise<NoteImpressionRow[]> {
    return this.prisma.noteRediscoveryImpression.findMany({
      orderBy: { shownAt: "desc" },
      select: { noteId: true, sourceKey: true },
      where: { contextKey, shownOn, surface, userId },
    });
  }

  async listLastShownDatesBefore({
    noteIds,
    shownBefore,
    userId,
  }: {
    noteIds: string[];
    shownBefore: Date;
    userId: string;
  }): Promise<NoteLastShownRow[]> {
    if (noteIds.length === 0) {
      return [];
    }

    const groups = await this.prisma.noteRediscoveryImpression.groupBy({
      _max: { shownOn: true },
      by: ["noteId"],
      where: { noteId: { in: noteIds }, shownOn: { lt: shownBefore }, userId },
    });

    return groups.flatMap((group) => {
      const lastShownOn = group._max.shownOn;
      return lastShownOn === null ? [] : [{ lastShownOn, noteId: group.noteId }];
    });
  }

  async recordImpression(record: ImpressionRecord): Promise<number> {
    const created = await this.prisma.noteRediscoveryImpression.createMany({
      data: [
        {
          contextKey: record.contextKey,
          noteId: record.noteId,
          shownAt: record.shownAt,
          shownOn: record.shownOn,
          sourceKey: record.sourceKey,
          surface: record.surface,
          userId: record.userId,
        },
      ],
      skipDuplicates: true,
    });
    return created.count;
  }
}

function buildEligibleBookNoteWhere({
  createdBefore,
  userId,
}: {
  createdBefore: Date;
  userId: string;
}): Prisma.NoteWhereInput {
  return {
    ...SOFT_DELETE_SCOPE.active,
    book: SOFT_DELETE_SCOPE.active,
    bookId: { not: null },
    createdAt: { lt: createdBefore },
    entityType: "book",
    isSpoiler: false,
    userId,
  };
}

function buildEligiblePoolNoteWhere({
  createdBefore,
  userId,
}: {
  createdBefore: Date;
  userId: string;
}): Prisma.NoteWhereInput {
  return {
    ...SOFT_DELETE_SCOPE.active,
    createdAt: { lt: createdBefore },
    isSpoiler: false,
    userId,
  };
}

function buildEligibleSeriesPoolWhere({
  createdBefore,
  seriesId,
  userId,
}: {
  createdBefore: Date;
  seriesId: string;
  userId: string;
}): Prisma.NoteWhereInput {
  const seriesIds = [seriesId];
  return {
    ...buildEligiblePoolNoteWhere({ createdBefore, userId }),
    OR: [buildPoolSeriesNoteWhere(seriesIds), buildPoolBookNoteWhere(seriesIds)],
  };
}

function buildPoolBookNoteWhere(seriesIds: string[]): Prisma.NoteWhereInput {
  return {
    book: {
      ...SOFT_DELETE_SCOPE.active,
      series: { ...SOFT_DELETE_SCOPE.active, id: { in: seriesIds } },
      seriesId: { in: seriesIds },
    },
    entityType: "book",
  };
}

function buildPoolSeriesNoteWhere(seriesIds: string[]): Prisma.NoteWhereInput {
  return {
    entityType: "series",
    series: { ...SOFT_DELETE_SCOPE.active, id: { in: seriesIds } },
    seriesId: { in: seriesIds },
  };
}

function toBookNoteCandidateRow(
  row: Prisma.NoteGetPayload<{ select: typeof bookNoteCandidateSelect }>,
): Nullable<BookNoteCandidateRow> {
  if (row.bookId === null) {
    return null;
  }
  return {
    bookId: row.bookId,
    createdAt: row.createdAt,
    id: row.id,
    isFavorite: row.isFavorite,
    isPinned: row.isPinned,
  };
}

function toNoteSourceRef({
  bookId,
  entityType,
  seriesId,
}: {
  bookId: Nullable<string>;
  entityType: string;
  seriesId: Nullable<string>;
}): Nullable<NoteSourceRef> {
  if (entityType === "series" && seriesId !== null) {
    return { id: seriesId, type: "series" };
  }
  if (entityType === "book" && bookId !== null) {
    return { id: bookId, type: "book" };
  }
  return null;
}

function toSeriesPoolCandidateRow(
  row: Prisma.NoteGetPayload<{ select: typeof seriesPoolCandidateSelect }>,
): Nullable<SeriesPoolCandidateRow> {
  const source = toNoteSourceRef(row);
  if (source === null) {
    return null;
  }
  return {
    createdAt: row.createdAt,
    id: row.id,
    isFavorite: row.isFavorite,
    isPinned: row.isPinned,
    source,
  };
}
