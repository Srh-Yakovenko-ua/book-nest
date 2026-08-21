import type { BookFacetScope } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { ilikeContains } from "../../../core/database/like-pattern.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { createLogger } from "../../../core/logger.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { LIBRARY_OVERVIEW } from "../domain/library-overview.js";
import { WISHLIST_OWNERSHIP_STATUS } from "../domain/wishlist-added-at.js";

const log = createLogger("book-facets.repository");

export const BOOK_FACETS = {
  maxRows: 200,
} as const;

const AuthorFacetRowSchema = z.object({
  count: z.number(),
  id: z.string(),
  name: z.string(),
});

const GenreFacetRowSchema = z.object({
  count: z.number(),
  key: z.string(),
});

export type BookAuthorFacetRow = z.infer<typeof AuthorFacetRowSchema>;

export type BookGenreFacetRow = z.infer<typeof GenreFacetRowSchema>;

type FacetsInput = {
  scope: BookFacetScope;
  search: string | undefined;
  userId: string;
};

const SCOPE_CONDITION: Record<BookFacetScope, Prisma.Sql> = {
  all: Prisma.empty,
  favorites: Prisma.sql`AND b.is_favorite = true`,
  my: Prisma.sql`AND b.ownership_status = ANY(${LIBRARY_OVERVIEW.physicalOwnershipStatuses}::text[])`,
  queue: Prisma.sql`AND b.queue_position IS NOT NULL`,
  series: Prisma.sql`AND b.series_id IS NOT NULL`,
  wishlist: Prisma.sql`AND b.ownership_status = ${WISHLIST_OWNERSHIP_STATUS}`,
};

@Injectable()
export class BookFacetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async authorFacets({ scope, search, userId }: FacetsInput): Promise<BookAuthorFacetRow[]> {
    const result = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        a.id::text AS "id",
        a.name AS "name",
        count(*)::int AS "count"
      FROM books b
      JOIN book_authors ba ON ba.book_id = b.id
      JOIN authors a ON a.id = ba.author_id
      WHERE b.user_id = ${userId}::uuid AND b.deleted_at IS NULL ${SCOPE_CONDITION[scope]}
        ${nameMatches("a.name", search)}
      GROUP BY a.id, a.name
      ORDER BY count(*) DESC, a.name ASC
      LIMIT ${BOOK_FACETS.maxRows}
    `);
    const rows = z.array(AuthorFacetRowSchema).parse(result);
    this.warnWhenTruncated({ kind: "author", rows: rows.length, scope, userId });
    return rows;
  }

  async genreFacets({ scope, userId }: FacetsInput): Promise<BookGenreFacetRow[]> {
    const result = await this.prisma.$queryRaw(Prisma.sql`
      SELECT
        g.key AS "key",
        count(*)::int AS "count"
      FROM books b
      CROSS JOIN LATERAL unnest(b.genres) AS g(key)
      WHERE b.user_id = ${userId}::uuid AND b.deleted_at IS NULL ${SCOPE_CONDITION[scope]}
      GROUP BY g.key
      ORDER BY count(*) DESC, g.key ASC
      LIMIT ${BOOK_FACETS.maxRows}
    `);
    const rows = z.array(GenreFacetRowSchema).parse(result);
    this.warnWhenTruncated({ kind: "genre", rows: rows.length, scope, userId });
    return rows;
  }

  private warnWhenTruncated({
    kind,
    rows,
    scope,
    userId,
  }: {
    kind: "author" | "genre";
    rows: number;
    scope: BookFacetScope;
    userId: string;
  }): void {
    if (rows < BOOK_FACETS.maxRows) return;
    log.warn({ cap: BOOK_FACETS.maxRows, kind, scope, userId }, "book facets truncated at the cap");
  }
}

function nameMatches(column: string, search: string | undefined): Prisma.Sql {
  if (search === undefined) return Prisma.empty;
  return Prisma.sql`AND ${ilikeContains({ column: Prisma.raw(column), search })}`;
}
