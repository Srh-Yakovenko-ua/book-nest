import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { type BookNotesDataset, buildBookNotesWhere } from "./book-notes-where.js";
import {
  buildSeriesNotesDatasetConditions,
  parseSeriesNotesTotal,
  SERIES_NOTES_SQL,
  type SeriesNotesDataset,
} from "./series-notes-sql.js";

@Injectable()
export class NotesSummaryRepository {
  constructor(private readonly prisma: PrismaService) {}

  countBookNotesCreatedSince({
    dataset,
    since,
  }: {
    dataset: BookNotesDataset;
    since: Date;
  }): Promise<number> {
    return this.prisma.note.count({
      where: {
        AND: [buildBookNotesWhere({ dataset, quickFilter: "all" }), { createdAt: { gte: since } }],
      },
    });
  }

  async countSeriesNotesCreatedSince({
    dataset,
    since,
  }: {
    dataset: SeriesNotesDataset;
    since: Date;
  }): Promise<number> {
    const rows = await this.prisma.$queryRaw(
      buildSeriesNotesCreatedSinceCountQuery({ dataset, since }),
    );
    return parseSeriesNotesTotal(rows);
  }
}

function buildSeriesNotesCreatedSinceCountQuery({
  dataset,
  since,
}: {
  dataset: SeriesNotesDataset;
  since: Date;
}): Prisma.Sql {
  return Prisma.sql`
    SELECT count(*)::int AS total
    FROM ${SERIES_NOTES_SQL.from}
    WHERE ${buildSeriesNotesDatasetConditions(dataset)}
      AND note.created_at >= ${since}
  `;
}
