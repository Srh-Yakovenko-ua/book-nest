import type {
  CharacterRelationshipListQuery,
  CharacterRelationshipListSort,
  Nullable,
  RelationshipBookStateStatus,
} from "@app/shared";

import { Injectable } from "@nestjs/common";
import { z } from "zod";

import type {
  ReaderBook,
  ReaderBookPosition,
  ReaderScope,
} from "../domain/relationship-reader-projection.js";

import { assertNever } from "../../../core/assert-never.js";
import { ilikeContains } from "../../../core/database/like-pattern.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { ACTIVE_PARTICIPANTS_SCOPE } from "./character-relationships.repository.js";

export type RelationshipListFilters = Pick<
  CharacterRelationshipListQuery,
  "bookId" | "categories" | "intensities" | "isCanonical" | "q" | "relationshipTypes" | "statuses"
>;

export type RelationshipListItemRow = Prisma.CharacterRelationshipGetPayload<{
  include: typeof listItemInclude;
}>;

export type RelationshipListSearchInput = {
  characterId: Nullable<string>;
  filters: RelationshipListFilters;
  readerBooks: ReaderBook[];
  scope: ReaderScope;
  skip: number;
  sort: CharacterRelationshipListSort;
  take: number;
  userId: string;
};

export type RelationshipListSearchResult = {
  ids: string[];
  totalCount: number;
};

type CandidateQueryInput = Omit<RelationshipListSearchInput, "skip" | "sort" | "take">;

type ContentMarkerColumns = {
  audioSeconds: Prisma.Sql;
  chapter: Prisma.Sql;
  page: Prisma.Sql;
};

type EdgeScopeInput = Pick<CandidateQueryInput, "characterId" | "userId">;

type ReaderUnits = {
  audioSeconds: Nullable<number>;
  chapter: Nullable<number>;
  page: Nullable<number>;
};

const readerParticipantSelect = {
  avatarMedia: true,
  id: true,
  name: true,
} satisfies Prisma.CharacterSelect;

const listItemInclude = {
  bookStates: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
  sourceCharacter: { select: readerParticipantSelect },
  targetCharacter: { select: readerParticipantSelect },
} satisfies Prisma.CharacterRelationshipInclude;

const READER_POSITION_KIND = {
  finished: "finished",
  position: "position",
} as const satisfies Record<string, ReaderBookPosition["kind"]>;

const ENDED_STATUS = "ended" satisfies RelationshipBookStateStatus;

const NO_READER_UNITS: ReaderUnits = { audioSeconds: null, chapter: null, page: null };

const IdRowSchema = z.object({ id: z.string() });

const CountRowSchema = z.object({ count: z.number() });

const INTRODUCTION_MARKER: ContentMarkerColumns = {
  audioSeconds: Prisma.sql`st.introduced_audio_seconds`,
  chapter: Prisma.sql`st.introduced_chapter`,
  page: Prisma.sql`st.introduced_page`,
};

const END_MARKER: ContentMarkerColumns = {
  audioSeconds: Prisma.sql`st.ended_audio_seconds`,
  chapter: Prisma.sql`st.ended_chapter`,
  page: Prisma.sql`st.ended_page`,
};

const FULLY_UNMASKED_STATE = Prisma.sql`
  gated.permitted
  AND gated.end_reached
  AND NOT gated.is_type_spoiler
  AND NOT gated.is_description_spoiler
`;

const PARTICIPANTS_JOIN = Prisma.sql`
  JOIN characters source_character
    ON source_character.id = rel.source_character_id AND source_character.deleted_at IS NULL
  JOIN characters target_character
    ON target_character.id = rel.target_character_id AND target_character.deleted_at IS NULL
`;

const CANDIDATE_ORDER_BY: Record<CharacterRelationshipListSort, Prisma.Sql> = {
  name_asc: Prisma.sql`primary_name ASC, secondary_name ASC, id ASC`,
  name_desc: Prisma.sql`primary_name DESC, secondary_name DESC, id ASC`,
  newest: Prisma.sql`created_at DESC, id ASC`,
  recently_updated: Prisma.sql`visible_changed_at DESC, id ASC`,
};

@Injectable()
export class CharacterRelationshipsListRepository {
  constructor(private readonly prisma: PrismaService) {}

  findReaderRelationships({
    ids,
    userId,
  }: {
    ids: string[];
    userId: string;
  }): Promise<RelationshipListItemRow[]> {
    if (ids.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.characterRelationship.findMany({
      include: listItemInclude,
      where: { ...ACTIVE_PARTICIPANTS_SCOPE, id: { in: ids }, userId },
    });
  }

  async listStateBookIdsOfCharacterEdges({
    characterId,
    userId,
  }: {
    characterId: string;
    userId: string;
  }): Promise<string[]> {
    const rows = await this.prisma.characterRelationshipBookState.findMany({
      distinct: ["bookId"],
      select: { bookId: true },
      where: {
        relationship: {
          ...ACTIVE_PARTICIPANTS_SCOPE,
          OR: [{ sourceCharacterId: characterId }, { targetCharacterId: characterId }],
          userId,
        },
      },
    });
    return rows.map((row) => row.bookId);
  }

  async searchVisible({
    skip,
    sort,
    take,
    ...input
  }: RelationshipListSearchInput): Promise<RelationshipListSearchResult> {
    const candidates = buildCandidatesQuery(input);
    const where = buildCandidateWhere(input);
    const [countRows, idRows] = await Promise.all([
      this.prisma.$queryRaw(Prisma.sql`
        ${candidates}
        SELECT (count(*))::int AS "count" FROM candidates WHERE ${where}
      `),
      this.prisma.$queryRaw(Prisma.sql`
        ${candidates}
        SELECT id FROM candidates WHERE ${where}
        ORDER BY ${CANDIDATE_ORDER_BY[sort]}
        LIMIT ${take} OFFSET ${skip}
      `),
    ]);
    return {
      ids: z
        .array(IdRowSchema)
        .parse(idRows)
        .map((row) => row.id),
      totalCount: z.array(CountRowSchema).parse(countRows)[0]?.count ?? 0,
    };
  }
}

function buildCandidatesQuery(input: CandidateQueryInput): Prisma.Sql {
  const scopeCtes = buildScopeCtes(input);
  return Prisma.sql`
    WITH ${buildPositionsCte(input.readerBooks)},
    gated AS (
      SELECT
        st.id,
        st.relationship_id,
        st.book_id,
        st.status,
        st.intensity,
        st.description,
        st.is_type_spoiler,
        st.is_description_spoiler,
        st.created_at,
        st.updated_at,
        pos.part_number,
        (NOT st.hide_relationship_as_spoiler AND ${reachedSql(INTRODUCTION_MARKER)}) AS permitted,
        ${reachedSql(END_MARKER)} AS end_reached
      FROM character_relationship_book_states st
      JOIN pos ON pos.book_id = st.book_id
      ${incidentStatesFilter(input)}
    ),
    ${scopeCtes}
  `;
}

function buildCandidateWhere({ filters, scope }: CandidateQueryInput): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (filters.categories !== undefined && filters.categories.length > 0) {
    conditions.push(Prisma.sql`category = ANY(${filters.categories}::text[])`);
  }
  if (filters.relationshipTypes !== undefined && filters.relationshipTypes.length > 0) {
    conditions.push(Prisma.sql`type = ANY(${filters.relationshipTypes}::text[])`);
  }
  if (filters.isCanonical !== undefined) {
    conditions.push(Prisma.sql`is_canonical = ${filters.isCanonical}`);
  }
  conditions.push(...scopedStateConditions({ filters, scope }));
  return conditions.length === 0 ? Prisma.sql`true` : Prisma.join(conditions, " AND ");
}

function buildEffectiveStateCtes(input: CandidateQueryInput): Prisma.Sql {
  return Prisma.sql`
    ranked AS (
      SELECT
        gated.*,
        ROW_NUMBER() OVER (
          PARTITION BY gated.relationship_id
          ORDER BY gated.part_number DESC NULLS LAST, gated.created_at DESC, gated.id DESC
        ) AS effective_rank,
        max(gated.updated_at) FILTER (WHERE ${FULLY_UNMASKED_STATE})
          OVER (PARTITION BY gated.relationship_id) AS unmasked_changed_at
      FROM gated
    ),
    candidates AS (
      SELECT
        rel.id,
        rel.created_at,
        ${participantNameColumns(input.characterId)},
        eff.is_type_spoiler AS type_hidden,
        ${maskedEdgeColumns(Prisma.sql`eff.is_type_spoiler`)},
        CASE
          WHEN eff.status = ${ENDED_STATUS} AND NOT eff.end_reached THEN NULL
          ELSE eff.status
        END AS status,
        CASE WHEN eff.is_type_spoiler THEN NULL ELSE eff.intensity END AS intensity,
        CASE WHEN eff.is_description_spoiler THEN NULL ELSE eff.description END AS description,
        GREATEST(
          rel.created_at,
          CASE
            WHEN eff.is_type_spoiler THEN NULL
            ELSE GREATEST(rel.updated_at, eff.unmasked_changed_at)
          END
        ) AS visible_changed_at
      FROM ranked eff
      JOIN character_relationships rel ON rel.id = eff.relationship_id
      ${PARTICIPANTS_JOIN}
      WHERE eff.effective_rank = 1
        AND eff.permitted
        AND ${edgeScopeCondition(input)}
    )
  `;
}

function buildGlobalCtes(input: CandidateQueryInput): Prisma.Sql {
  const typeHidden = Prisma.sql`COALESCE(summaries.type_hidden, false)`;
  return Prisma.sql`
    summaries AS (
      SELECT
        gated.relationship_id,
        bool_or(gated.is_type_spoiler) AS type_hidden,
        max(gated.updated_at) FILTER (WHERE ${FULLY_UNMASKED_STATE}) AS unmasked_changed_at,
        ${summaryStateFilterMatch(input.filters)} AS state_filter_match,
        ${summaryBookMatch(input.filters)} AS book_match,
        ${summaryDescriptionMatch(input.filters)} AS description_match
      FROM gated
      WHERE gated.permitted
      GROUP BY gated.relationship_id
    ),
    candidates AS (
      SELECT
        rel.id,
        rel.created_at,
        ${participantNameColumns(input.characterId)},
        ${typeHidden} AS type_hidden,
        ${maskedEdgeColumns(typeHidden)},
        summaries.state_filter_match,
        summaries.book_match,
        summaries.description_match,
        GREATEST(
          rel.created_at,
          CASE
            WHEN ${typeHidden} THEN NULL
            ELSE GREATEST(rel.updated_at, summaries.unmasked_changed_at)
          END
        ) AS visible_changed_at
      FROM character_relationships rel
      ${PARTICIPANTS_JOIN}
      LEFT JOIN summaries ON summaries.relationship_id = rel.id
      WHERE ${edgeScopeCondition(input)}
        AND (
          summaries.relationship_id IS NOT NULL
          OR NOT EXISTS (
            SELECT 1
            FROM character_relationship_book_states any_state
            WHERE any_state.relationship_id = rel.id
          )
        )
    )
  `;
}

function buildPositionsCte(readerBooks: ReaderBook[]): Prisma.Sql {
  const units = readerBooks.map((book) => readerUnitsOf(book.position));
  return Prisma.sql`
    pos AS (
      SELECT *
      FROM unnest(
        ${readerBooks.map((book) => book.id)}::uuid[],
        ${readerBooks.map((book) => book.partNumber)}::int[],
        ${readerBooks.map((book) => book.position.kind)}::text[],
        ${units.map((unit) => unit.page)}::int[],
        ${units.map((unit) => unit.chapter)}::int[],
        ${units.map((unit) => unit.audioSeconds)}::int[]
      ) AS pos(book_id, part_number, kind, page, chapter, audio_seconds)
    )
  `;
}

function buildScopeCtes(input: CandidateQueryInput): Prisma.Sql {
  switch (input.scope.kind) {
    case "as_of":
    case "direct":
      return buildEffectiveStateCtes(input);
    case "global":
      return buildGlobalCtes(input);
    default:
      return assertNever(input.scope);
  }
}

function chapterDeclaredSql(chapter: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`COALESCE(${chapter} ~ '[^[:space:]]', false)`;
}

function edgeScopeCondition({ characterId, userId }: EdgeScopeInput): Prisma.Sql {
  if (characterId === null) {
    return Prisma.sql`rel.user_id = ${userId}::uuid`;
  }
  return Prisma.sql`rel.user_id = ${userId}::uuid
    AND (
      rel.source_character_id = ${characterId}::uuid
      OR rel.target_character_id = ${characterId}::uuid
    )`;
}

function effectiveStateConditions(filters: RelationshipListFilters): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (filters.statuses !== undefined && filters.statuses.length > 0) {
    conditions.push(Prisma.sql`status = ANY(${filters.statuses}::text[])`);
  }
  if (filters.intensities !== undefined && filters.intensities.length > 0) {
    conditions.push(Prisma.sql`intensity = ANY(${filters.intensities}::text[])`);
  }
  if (filters.q !== undefined) {
    conditions.push(
      searchCondition({
        descriptionMatch: ilikeContains({ column: Prisma.sql`description`, search: filters.q }),
        search: filters.q,
      }),
    );
  }
  return conditions;
}

function globalStateConditions(filters: RelationshipListFilters): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  if (hasStateValueFilter(filters)) {
    conditions.push(Prisma.sql`state_filter_match IS TRUE`);
  }
  if (filters.intensities !== undefined && filters.intensities.length > 0) {
    conditions.push(Prisma.sql`NOT type_hidden`);
  }
  if (filters.bookId !== undefined) {
    conditions.push(Prisma.sql`book_match IS TRUE`);
  }
  if (filters.q !== undefined) {
    conditions.push(
      searchCondition({
        descriptionMatch: Prisma.sql`description_match IS TRUE`,
        search: filters.q,
      }),
    );
  }
  return conditions;
}

function hasStateValueFilter(filters: RelationshipListFilters): boolean {
  return (
    (filters.statuses !== undefined && filters.statuses.length > 0) ||
    (filters.intensities !== undefined && filters.intensities.length > 0)
  );
}

function incidentStatesFilter({ characterId, userId }: EdgeScopeInput): Prisma.Sql {
  if (characterId === null) {
    return Prisma.empty;
  }
  return Prisma.sql`
    WHERE st.relationship_id IN (
      SELECT incident.id
      FROM character_relationships incident
      WHERE incident.user_id = ${userId}::uuid
        AND (
          incident.source_character_id = ${characterId}::uuid
          OR incident.target_character_id = ${characterId}::uuid
        )
    )
  `;
}

function integerChapterSql(chapter: Prisma.Sql): Prisma.Sql {
  const digits = Prisma.sql`substring(${chapter} from '[0-9]+')::numeric`;
  return Prisma.sql`(CASE
    WHEN ${chapter} ~ '^[[:space:]]*[0-9]+[[:space:]]*$'
      AND ${digits} <= ${Number.MAX_SAFE_INTEGER}::numeric
    THEN ${digits}
  END)`;
}

function maskedEdgeColumns(typeHidden: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`
    CASE WHEN ${typeHidden} THEN NULL ELSE rel.category END AS category,
    CASE WHEN ${typeHidden} THEN NULL ELSE rel.type END AS type,
    CASE WHEN ${typeHidden} THEN NULL ELSE rel.custom_type END AS custom_type,
    CASE WHEN ${typeHidden} THEN NULL ELSE rel.source_label END AS source_label,
    CASE WHEN ${typeHidden} THEN NULL ELSE rel.target_label END AS target_label,
    CASE WHEN ${typeHidden} THEN NULL ELSE rel.is_canonical END AS is_canonical
  `;
}

function participantNameColumns(characterId: Nullable<string>): Prisma.Sql {
  if (characterId === null) {
    return Prisma.sql`
      LEAST(source_character.name, target_character.name) AS primary_name,
      GREATEST(source_character.name, target_character.name) AS secondary_name
    `;
  }
  const otherName = Prisma.sql`CASE
    WHEN rel.source_character_id = ${characterId}::uuid THEN target_character.name
    ELSE source_character.name
  END`;
  return Prisma.sql`${otherName} AS primary_name, ${otherName} AS secondary_name`;
}

function reachedSql(marker: ContentMarkerColumns): Prisma.Sql {
  const markerChapterNumber = integerChapterSql(marker.chapter);
  return Prisma.sql`(CASE
    WHEN ${marker.page} IS NULL
      AND ${marker.audioSeconds} IS NULL
      AND NOT ${chapterDeclaredSql(marker.chapter)} THEN true
    WHEN pos.kind = ${READER_POSITION_KIND.finished} THEN true
    WHEN pos.kind IS DISTINCT FROM ${READER_POSITION_KIND.position} THEN false
    WHEN pos.page IS NULL AND pos.chapter IS NULL AND pos.audio_seconds IS NULL THEN true
    WHEN ${marker.page} IS NOT NULL AND pos.page IS NOT NULL THEN pos.page >= ${marker.page}
    WHEN ${markerChapterNumber} IS NOT NULL AND pos.chapter IS NOT NULL
      THEN pos.chapter >= ${markerChapterNumber}
    WHEN ${marker.audioSeconds} IS NOT NULL AND pos.audio_seconds IS NOT NULL
      THEN pos.audio_seconds >= ${marker.audioSeconds}
    ELSE false
  END)`;
}

function readerUnitsOf(position: ReaderBookPosition): ReaderUnits {
  if (position.kind !== "position") {
    return NO_READER_UNITS;
  }
  return {
    audioSeconds: position.reader.audioSeconds ?? null,
    chapter: position.reader.chapter ?? null,
    page: position.reader.page ?? null,
  };
}

function scopedStateConditions({
  filters,
  scope,
}: Pick<CandidateQueryInput, "filters" | "scope">): Prisma.Sql[] {
  switch (scope.kind) {
    case "as_of":
    case "direct":
      return effectiveStateConditions(filters);
    case "global":
      return globalStateConditions(filters);
    default:
      return assertNever(scope);
  }
}

function searchCondition({
  descriptionMatch,
  search,
}: {
  descriptionMatch: Prisma.Sql;
  search: string;
}): Prisma.Sql {
  const searchableColumns = [
    Prisma.sql`primary_name`,
    Prisma.sql`secondary_name`,
    Prisma.sql`custom_type`,
    Prisma.sql`source_label`,
    Prisma.sql`target_label`,
  ];
  const matches = searchableColumns.map((column) => ilikeContains({ column, search }));
  return Prisma.sql`(${Prisma.join([...matches, descriptionMatch], " OR ")})`;
}

function summaryBookMatch(filters: RelationshipListFilters): Prisma.Sql {
  if (filters.bookId === undefined) {
    return Prisma.sql`true`;
  }
  return Prisma.sql`bool_or(gated.book_id = ${filters.bookId}::uuid)`;
}

function summaryDescriptionMatch(filters: RelationshipListFilters): Prisma.Sql {
  if (filters.q === undefined) {
    return Prisma.sql`false`;
  }
  const descriptionMatch = ilikeContains({
    column: Prisma.sql`gated.description`,
    search: filters.q,
  });
  return Prisma.sql`bool_or(NOT gated.is_description_spoiler AND ${descriptionMatch})`;
}

function summaryStateFilterMatch(filters: RelationshipListFilters): Prisma.Sql {
  if (!hasStateValueFilter(filters)) {
    return Prisma.sql`true`;
  }
  const statusMatch =
    filters.statuses !== undefined && filters.statuses.length > 0
      ? Prisma.sql`(CASE
          WHEN gated.status = ${ENDED_STATUS} AND NOT gated.end_reached THEN NULL
          ELSE gated.status
        END) = ANY(${filters.statuses}::text[])`
      : Prisma.sql`true`;
  const intensityMatch =
    filters.intensities !== undefined && filters.intensities.length > 0
      ? Prisma.sql`gated.intensity = ANY(${filters.intensities}::text[])`
      : Prisma.sql`true`;
  return Prisma.sql`bool_or((${statusMatch}) AND (${intensityMatch}))`;
}
