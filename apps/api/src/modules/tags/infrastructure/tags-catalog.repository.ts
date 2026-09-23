import type {
  TagQuickCounts,
  TagQuickFilter,
  TagsCatalogFacetsQuery,
  TagSort,
  TagType,
} from "@app/shared";

import {
  TAG_COLOR_DEFAULT,
  TAG_COLORS,
  TAG_SUMMARY_RULES,
  TagColorSchema,
  TagsMostUsedLeaderSchema,
  TagTypeSchema,
  TagUsageDistributionSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type {
  TaggedEntityCounts,
  TagsSummaryAggregate,
  TagUsageAggregate,
} from "../domain/tag-usage.js";

import { assertNever } from "../../../core/assert-never.js";
import { ACTIVE_BOOK_SQL } from "../../../core/database/active-book-sql.js";
import { ilikeContains } from "../../../core/database/like-pattern.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

type ListTagsCatalogInput = {
  criteria: TagsDatasetCriteria;
  filter: TagQuickFilter;
  skip: number;
  sort: TagSort;
  take: number;
  userId: string;
};

type TagsDatasetCriteria = TagsCatalogFacetsQuery;

const TagUsageRowSchema = z.object({
  booksCount: z.number().int(),
  charactersCount: z.number().int(),
  color: TagColorSchema,
  description: z.string().nullable(),
  id: z.string(),
  name: z.string(),
  type: TagTypeSchema,
  usageCount: z.number().int(),
});

const TotalCountRowSchema = z.object({ totalCount: z.number().int() });

const TagsSummaryAggregateRowSchema = z.object({
  colorCounts: z.partialRecord(TagColorSchema, z.number().int()),
  leaders: z.array(TagsMostUsedLeaderSchema),
  leadersCount: z.number().int(),
  topUsageCount: z.number().int(),
  totalTagsCount: z.number().int(),
  typeCounts: z.partialRecord(TagTypeSchema, z.number().int()),
  usageDistribution: TagUsageDistributionSchema,
});

const TagQuickCountsRowSchema = z.object({
  all: z.number().int(),
  books: z.number().int(),
  characters: z.number().int(),
  unused: z.number().int(),
  used: z.number().int(),
});

const TaggedEntityCountsRowSchema = z.object({
  taggedBooksCount: z.number().int(),
  taggedCharactersCount: z.number().int(),
  totalBooksCount: z.number().int(),
  totalCharactersCount: z.number().int(),
});

const visibleCharacter = (alias: Prisma.Sql): Prisma.Sql =>
  Prisma.sql`${alias}.deleted_at IS NULL AND ${alias}.archived_at IS NULL`;

const TAG_TYPE_RANK = Prisma.sql`CASE tag_usage.type ${Prisma.join(
  TagTypeSchema.options.map(
    (type: TagType, index) => Prisma.sql`WHEN ${type} THEN ${index + 1}::int`,
  ),
  " ",
)} END`;

const NAME_THEN_ID = Prisma.sql`tag_usage.name ASC, tag_usage.id ASC`;

const QUICK_FILTER_CONDITION: Record<TagQuickFilter, Prisma.Sql> = {
  all: Prisma.sql`TRUE`,
  books: Prisma.sql`tag_usage.books_count > 0`,
  characters: Prisma.sql`tag_usage.characters_count > 0`,
  unused: Prisma.sql`tag_usage.usage_count = 0`,
  used: Prisma.sql`tag_usage.usage_count > 0`,
};

const TAG_USAGE_COLUMNS = Prisma.sql`
  tag_usage.id::text AS "id",
  tag_usage.name AS "name",
  tag_usage.description AS "description",
  tag_usage.type AS "type",
  tag_usage.color AS "color",
  tag_usage.books_count AS "booksCount",
  tag_usage.characters_count AS "charactersCount",
  tag_usage.usage_count AS "usageCount"
`;

@Injectable()
export class TagsCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateSummary(userId: string): Promise<TagsSummaryAggregate> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      ${tagUsageCte(userId)},
      top_usage AS (
        SELECT coalesce(max(tag_usage.usage_count), 0)::int AS usage_count
        FROM tag_usage
      )
      SELECT
        (SELECT count(*) FROM tag_usage)::int AS "totalTagsCount",
        top_usage.usage_count AS "topUsageCount",
        (
          SELECT count(*)
          FROM tag_usage
          WHERE tag_usage.usage_count = top_usage.usage_count AND top_usage.usage_count > 0
        )::int AS "leadersCount",
        (
          SELECT coalesce(jsonb_object_agg(type_count.type, type_count.tags_count), '{}'::jsonb)
          FROM (
            SELECT tag_usage.type, count(*)::int AS tags_count
            FROM tag_usage
            GROUP BY tag_usage.type
          ) type_count
        ) AS "typeCounts",
        (
          SELECT coalesce(jsonb_object_agg(color_count.color, color_count.tags_count), '{}'::jsonb)
          FROM (
            SELECT tag_usage.color, count(*)::int AS tags_count
            FROM tag_usage
            GROUP BY tag_usage.color
          ) color_count
        ) AS "colorCounts",
        (
          SELECT jsonb_build_object(
            'booksOnly', count(*) FILTER (WHERE tag_usage.books_count > 0 AND tag_usage.characters_count = 0),
            'charactersOnly', count(*) FILTER (WHERE tag_usage.books_count = 0 AND tag_usage.characters_count > 0),
            'both', count(*) FILTER (WHERE tag_usage.books_count > 0 AND tag_usage.characters_count > 0),
            'unused', count(*) FILTER (WHERE ${QUICK_FILTER_CONDITION.unused})
          )
          FROM tag_usage
        ) AS "usageDistribution",
        (
          SELECT coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', leader.id::text,
                'name', leader.name,
                'booksCount', leader.books_count,
                'charactersCount', leader.characters_count
              )
              ORDER BY leader.name ASC, leader.id ASC
            ),
            '[]'::jsonb
          )
          FROM (
            SELECT tag_usage.id, tag_usage.name, tag_usage.books_count, tag_usage.characters_count
            FROM tag_usage
            WHERE tag_usage.usage_count = top_usage.usage_count AND top_usage.usage_count > 0
            ORDER BY tag_usage.usage_count DESC, ${NAME_THEN_ID}
            LIMIT ${TAG_SUMMARY_RULES.leadersLimit}
          ) leader
        ) AS "leaders"
      FROM top_usage
    `);
    const [aggregate] = z.tuple([TagsSummaryAggregateRowSchema]).parse(rows);
    return aggregate;
  }

  async countQuickFilters({
    criteria,
    userId,
  }: {
    criteria: TagsDatasetCriteria;
    userId: string;
  }): Promise<TagQuickCounts> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      ${tagUsageCte(userId)}
      SELECT
        count(*)::int AS "all",
        (count(*) FILTER (WHERE ${QUICK_FILTER_CONDITION.used}))::int AS "used",
        (count(*) FILTER (WHERE ${QUICK_FILTER_CONDITION.books}))::int AS "books",
        (count(*) FILTER (WHERE ${QUICK_FILTER_CONDITION.characters}))::int AS "characters",
        (count(*) FILTER (WHERE ${QUICK_FILTER_CONDITION.unused}))::int AS "unused"
      FROM tag_usage
      WHERE ${datasetConditions(criteria)}
    `);
    const [counts] = z.tuple([TagQuickCountsRowSchema]).parse(rows);
    return counts;
  }

  async countTaggedEntities(userId: string): Promise<TaggedEntityCounts> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        (
          SELECT count(*)
          FROM books book
          WHERE book.user_id = ${userId}::uuid ${ACTIVE_BOOK_SQL}
        )::int AS "totalBooksCount",
        (
          SELECT count(*)
          FROM books book
          WHERE book.user_id = ${userId}::uuid
            ${ACTIVE_BOOK_SQL}
            AND EXISTS (
              SELECT 1
              FROM book_tags book_tag
              JOIN tags tag ON tag.id = book_tag.tag_id AND tag.user_id = ${userId}::uuid
              WHERE book_tag.book_id = book.id
            )
        )::int AS "taggedBooksCount",
        (
          SELECT count(*)
          FROM characters character_row
          WHERE character_row.user_id = ${userId}::uuid AND ${visibleCharacter(Prisma.sql`character_row`)}
        )::int AS "totalCharactersCount",
        (
          SELECT count(*)
          FROM characters character_row
          WHERE character_row.user_id = ${userId}::uuid
            AND ${visibleCharacter(Prisma.sql`character_row`)}
            AND EXISTS (
              SELECT 1
              FROM character_tags character_tag
              JOIN tags tag ON tag.id = character_tag.tag_id AND tag.user_id = ${userId}::uuid
              WHERE character_tag.character_id = character_row.id
            )
        )::int AS "taggedCharactersCount"
    `);
    const [counts] = z.tuple([TaggedEntityCountsRowSchema]).parse(rows);
    return counts;
  }

  async list({
    criteria,
    filter,
    skip,
    sort,
    take,
    userId,
  }: ListTagsCatalogInput): Promise<{ items: TagUsageAggregate[]; totalCount: number }> {
    const where = Prisma.sql`${datasetConditions(criteria)} AND ${QUICK_FILTER_CONDITION[filter]}`;
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      ${tagUsageCte(userId)}
      SELECT ${TAG_USAGE_COLUMNS}, (count(*) OVER ())::int AS "totalCount"
      FROM tag_usage
      WHERE ${where}
      ORDER BY ${orderBy(sort)}
      LIMIT ${take}
      OFFSET ${skip}
    `);
    const items = z.array(TagUsageRowSchema).parse(rows);
    const [firstRow] = z.array(TotalCountRowSchema).parse(rows);
    if (firstRow !== undefined) return { items, totalCount: firstRow.totalCount };
    if (skip === 0) return { items, totalCount: 0 };
    return { items, totalCount: await this.countListed({ userId, where }) };
  }

  private async countListed({
    userId,
    where,
  }: {
    userId: string;
    where: Prisma.Sql;
  }): Promise<number> {
    const rows = await this.prisma.$queryRaw(Prisma.sql`
      ${tagUsageCte(userId)}
      SELECT count(*)::int AS "totalCount"
      FROM tag_usage
      WHERE ${where}
    `);
    const [{ totalCount }] = z.tuple([TotalCountRowSchema]).parse(rows);
    return totalCount;
  }
}

function datasetConditions({ color, q, type }: TagsDatasetCriteria): Prisma.Sql {
  const conditions: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (q !== undefined) {
    conditions.push(
      Prisma.sql`(${ilikeContains({ column: Prisma.sql`tag_usage.name`, search: q })} OR ${ilikeContains({ column: Prisma.sql`tag_usage.description`, search: q })})`,
    );
  }
  if (type !== undefined) {
    conditions.push(Prisma.sql`tag_usage.type IN (${Prisma.join(type)})`);
  }
  if (color !== undefined) {
    conditions.push(Prisma.sql`tag_usage.color IN (${Prisma.join(color)})`);
  }
  return Prisma.join(conditions, " AND ");
}

function effectiveColor(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`CASE WHEN ${column} IN (${Prisma.join(TAG_COLORS)}) THEN ${column} ELSE ${TAG_COLOR_DEFAULT} END`;
}

function orderBy(sort: TagSort): Prisma.Sql {
  switch (sort) {
    case "books_count_desc":
      return Prisma.sql`tag_usage.books_count DESC, ${NAME_THEN_ID}`;
    case "characters_count_desc":
      return Prisma.sql`tag_usage.characters_count DESC, ${NAME_THEN_ID}`;
    case "created_desc":
      return Prisma.sql`tag_usage.created_at DESC, tag_usage.id ASC`;
    case "name_asc":
      return NAME_THEN_ID;
    case "type_asc":
      return Prisma.sql`${TAG_TYPE_RANK} ASC, ${NAME_THEN_ID}`;
    case "usage_count_desc":
      return Prisma.sql`tag_usage.usage_count DESC, ${NAME_THEN_ID}`;
    default:
      return assertNever(sort);
  }
}

function tagUsageCte(userId: string): Prisma.Sql {
  return Prisma.sql`
    WITH book_usage AS (
      SELECT book_tag.tag_id, count(DISTINCT book_tag.book_id)::int AS books_count
      FROM book_tags book_tag
      JOIN tags tag ON tag.id = book_tag.tag_id AND tag.user_id = ${userId}::uuid
      JOIN books book
        ON book.id = book_tag.book_id AND book.user_id = ${userId}::uuid ${ACTIVE_BOOK_SQL}
      GROUP BY book_tag.tag_id
    ),
    character_usage AS (
      SELECT character_tag.tag_id, count(DISTINCT character_tag.character_id)::int AS characters_count
      FROM character_tags character_tag
      JOIN tags tag ON tag.id = character_tag.tag_id AND tag.user_id = ${userId}::uuid
      JOIN characters character_row
        ON character_row.id = character_tag.character_id AND ${visibleCharacter(Prisma.sql`character_row`)}
      GROUP BY character_tag.tag_id
    ),
    tag_usage AS (
      SELECT
        tag.id,
        tag.name,
        tag.description,
        tag.type,
        tag.created_at,
        ${effectiveColor(Prisma.sql`tag.color`)} AS color,
        coalesce(book_usage.books_count, 0) AS books_count,
        coalesce(character_usage.characters_count, 0) AS characters_count,
        coalesce(book_usage.books_count, 0) + coalesce(character_usage.characters_count, 0) AS usage_count
      FROM tags tag
      LEFT JOIN book_usage ON book_usage.tag_id = tag.id
      LEFT JOIN character_usage ON character_usage.tag_id = tag.id
      WHERE tag.user_id = ${userId}::uuid
    )
  `;
}
