import type { NoteValueFacet } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type {
  NoteAuthorLink,
  NoteCategoryCount,
  NoteEntityCount,
  NoteFlagGroup,
} from "../domain/note-facets.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { type BookNotesDataset, buildBookNotesWhere } from "./book-notes-where.js";
import {
  buildSeriesNoteCategoryCountsQuery,
  buildSeriesNoteCountsQuery,
  buildSeriesNoteFlagGroupsQuery,
  buildSeriesNoteGenreCountsQuery,
} from "./series-notes-facets-sql.js";
import { type SeriesNotesDataset } from "./series-notes-sql.js";

const EntityCountRowSchema = z.object({
  count: z.number().int(),
  entityId: z.string(),
  label: z.string(),
});

const CategoryCountRowSchema = z.object({
  category: z.string().nullable(),
  count: z.number().int(),
  customCategory: z.string().nullable(),
});

const GenreCountRowSchema = z.object({ count: z.number().int(), value: z.string() });

const FlagGroupRowSchema = z.object({
  count: z.number().int(),
  isFavorite: z.boolean(),
  isPinned: z.boolean(),
  isSpoiler: z.boolean(),
});

const seriesCanonicalAuthorsSelect = {
  authors: { select: { author: { select: { id: true, name: true } } } },
  books: {
    select: {
      authors: { select: { author: { select: { id: true, name: true } }, position: true } },
      createdAt: true,
      partNumber: true,
    },
    where: SOFT_DELETE_SCOPE.active,
  },
  id: true,
} satisfies Prisma.SeriesSelect;

export type SeriesCanonicalAuthorsSource = Prisma.SeriesGetPayload<{
  select: typeof seriesCanonicalAuthorsSelect;
}>;

@Injectable()
export class NotesFacetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async bookAuthorLinks(bookIds: string[]): Promise<NoteAuthorLink[]> {
    if (bookIds.length === 0) {
      return [];
    }
    const links = await this.prisma.bookAuthor.findMany({
      select: { author: { select: { id: true, name: true } }, bookId: true },
      where: { bookId: { in: bookIds } },
    });
    return links.map((link) => ({ author: link.author, entityId: link.bookId }));
  }

  async bookNoteCategoryCounts(dataset: BookNotesDataset): Promise<NoteCategoryCount[]> {
    const groups = await this.prisma.note.groupBy({
      _count: { _all: true },
      by: ["category", "customCategory"],
      where: {
        AND: [
          buildBookNotesWhere({ dataset, quickFilter: "all" }),
          { OR: [{ category: { not: null } }, { customCategory: { not: null } }] },
        ],
      },
    });
    return groups.map((group) => ({
      category: group.category,
      count: group._count._all,
      customCategory: group.customCategory,
    }));
  }

  async bookNoteCounts(dataset: BookNotesDataset): Promise<NoteEntityCount[]> {
    const groups = await this.prisma.note.groupBy({
      _count: { _all: true },
      by: ["bookId"],
      where: buildBookNotesWhere({ dataset, quickFilter: "all" }),
    });
    const bookIds = groups.flatMap((group) => (group.bookId === null ? [] : [group.bookId]));
    if (bookIds.length === 0) {
      return [];
    }

    const books = await this.prisma.book.findMany({
      select: { id: true, title: true },
      where: { id: { in: bookIds } },
    });
    const titleById = new Map(books.map((book) => [book.id, book.title]));

    return groups.flatMap((group) => {
      const title = group.bookId === null ? undefined : titleById.get(group.bookId);
      if (group.bookId === null || title === undefined) {
        return [];
      }
      return [{ count: group._count._all, entityId: group.bookId, label: title }];
    });
  }

  async bookNoteFlagGroups(dataset: BookNotesDataset): Promise<NoteFlagGroup[]> {
    const groups = await this.prisma.note.groupBy({
      _count: { _all: true },
      by: ["isFavorite", "isPinned", "isSpoiler"],
      where: buildBookNotesWhere({ dataset, quickFilter: "all" }),
    });
    return groups.map((group) => ({
      count: group._count._all,
      isFavorite: group.isFavorite,
      isPinned: group.isPinned,
      isSpoiler: group.isSpoiler,
    }));
  }

  async seriesCanonicalAuthorSources(seriesIds: string[]): Promise<SeriesCanonicalAuthorsSource[]> {
    if (seriesIds.length === 0) {
      return [];
    }
    return this.prisma.series.findMany({
      select: seriesCanonicalAuthorsSelect,
      where: { id: { in: seriesIds } },
    });
  }

  async seriesNoteCategoryCounts(dataset: SeriesNotesDataset): Promise<NoteCategoryCount[]> {
    const rows = await this.prisma.$queryRaw(buildSeriesNoteCategoryCountsQuery(dataset));
    return z.array(CategoryCountRowSchema).parse(rows);
  }

  async seriesNoteCounts(dataset: SeriesNotesDataset): Promise<NoteEntityCount[]> {
    const rows = await this.prisma.$queryRaw(buildSeriesNoteCountsQuery(dataset));
    return z.array(EntityCountRowSchema).parse(rows);
  }

  async seriesNoteFlagGroups(dataset: SeriesNotesDataset): Promise<NoteFlagGroup[]> {
    const rows = await this.prisma.$queryRaw(buildSeriesNoteFlagGroupsQuery(dataset));
    return z.array(FlagGroupRowSchema).parse(rows);
  }

  async seriesNoteGenreCounts(dataset: SeriesNotesDataset): Promise<NoteValueFacet[]> {
    const rows = await this.prisma.$queryRaw(buildSeriesNoteGenreCountsQuery(dataset));
    return z.array(GenreCountRowSchema).parse(rows);
  }
}
