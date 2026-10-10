import type { Nullable, SpeciesMergeResult, SpeciesUsage } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { escapeLikePattern } from "../../../core/database/like-pattern.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { visibleToUser } from "../../../core/database/two-tier-visibility.js";
import { Prisma } from "../../../generated/prisma/client.js";

const speciesWithNamesArgs = {
  include: {
    names: { select: { kind: true, locale: true, name: true, normalizedName: true } },
  },
} satisfies Prisma.SpeciesDefaultArgs;

const SYSTEM_FIRST_ORDER = [
  { userId: { nulls: "first", sort: "asc" } },
  { name: "asc" },
  { id: "asc" },
] satisfies Prisma.SpeciesOrderByWithRelationInput[];

export type SpeciesWithNames = Prisma.SpeciesGetPayload<typeof speciesWithNamesArgs>;

type CountedRow = {
  count: number;
  speciesId: Nullable<string>;
};

type OwnedSpeciesInput = {
  id: string;
  userId: string;
};

@Injectable()
export class SpeciesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireUserLock(userId: string, client: Prisma.TransactionClient): Promise<void> {
    await acquireAdvisoryLock({ classId: ADVISORY_LOCK_CLASS.species, key: userId }, client);
  }

  async countUsage(
    { speciesIds, userId }: { speciesIds: readonly string[]; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReadonlyMap<string, SpeciesUsage>> {
    if (speciesIds.length === 0) {
      return new Map();
    }

    const characterScope = {
      speciesId: { in: [...speciesIds] },
      userId,
    } satisfies Prisma.CharacterWhereInput;
    const overrideScope = {
      character: { userId },
      speciesOverrideId: { in: [...speciesIds] },
    } satisfies Prisma.BookCharacterWhereInput;

    const [characters, trashedCharacters, bookOverrides, trashedBookOverrides] = await Promise.all([
      client.character.groupBy({
        _count: { _all: true },
        by: ["speciesId"],
        where: characterScope,
      }),
      client.character.groupBy({
        _count: { _all: true },
        by: ["speciesId"],
        where: { ...characterScope, ...SOFT_DELETE_SCOPE.trashed },
      }),
      client.bookCharacter.groupBy({
        _count: { _all: true },
        by: ["speciesOverrideId"],
        where: overrideScope,
      }),
      client.bookCharacter.groupBy({
        _count: { _all: true },
        by: ["speciesOverrideId"],
        where: {
          ...overrideScope,
          OR: [{ character: SOFT_DELETE_SCOPE.trashed }, { book: SOFT_DELETE_SCOPE.trashed }],
        },
      }),
    ]);

    const tally = {
      bookOverrides: countsBySpecies(
        bookOverrides.map((row) => ({ count: row._count._all, speciesId: row.speciesOverrideId })),
      ),
      characters: countsBySpecies(
        characters.map((row) => ({ count: row._count._all, speciesId: row.speciesId })),
      ),
      trashedBookOverrides: countsBySpecies(
        trashedBookOverrides.map((row) => ({
          count: row._count._all,
          speciesId: row.speciesOverrideId,
        })),
      ),
      trashedCharacters: countsBySpecies(
        trashedCharacters.map((row) => ({ count: row._count._all, speciesId: row.speciesId })),
      ),
    };

    return new Map(
      speciesIds.map((speciesId) => [
        speciesId,
        {
          bookOverrides: tally.bookOverrides.get(speciesId) ?? 0,
          characters: tally.characters.get(speciesId) ?? 0,
          trashed:
            (tally.trashedCharacters.get(speciesId) ?? 0) +
            (tally.trashedBookOverrides.get(speciesId) ?? 0),
        },
      ]),
    );
  }

  createCustom(
    { name, normalizedName, userId }: { name: string; normalizedName: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SpeciesWithNames> {
    return client.species.create({
      data: { name, normalizedName, userId },
      ...speciesWithNamesArgs,
    });
  }

  async deleteCustom(
    { id, userId }: OwnedSpeciesInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.species.deleteMany({ where: { id, userId } });
  }

  findAllVisible(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SpeciesWithNames[]> {
    return client.species.findMany({
      orderBy: SYSTEM_FIRST_ORDER,
      where: visibleToUser(userId),
      ...speciesWithNamesArgs,
    });
  }

  findOwn(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SpeciesWithNames[]> {
    return client.species.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      where: { userId },
      ...speciesWithNamesArgs,
    });
  }

  findOwnRecent(
    { limit, userId }: { limit: number; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SpeciesWithNames[]> {
    return client.species.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: limit,
      where: { userId },
      ...speciesWithNamesArgs,
    });
  }

  findSystemByKeys(
    keys: readonly string[],
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SpeciesWithNames[]> {
    return client.species.findMany({
      where: { key: { in: [...keys] }, userId: null },
      ...speciesWithNamesArgs,
    });
  }

  findVisibleById(
    { id, userId }: OwnedSpeciesInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<SpeciesWithNames>> {
    return client.species.findFirst({
      where: { AND: [{ id }, visibleToUser(userId)] },
      ...speciesWithNamesArgs,
    });
  }

  findVisibleByNormalizedName(
    { normalizedName, userId }: { normalizedName: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SpeciesWithNames[]> {
    return client.species.findMany({
      orderBy: SYSTEM_FIRST_ORDER,
      where: {
        AND: [
          visibleToUser(userId),
          { OR: [{ normalizedName }, { names: { some: { normalizedName } } }] },
        ],
      },
      ...speciesWithNamesArgs,
    });
  }

  async lockVisibleForReference(
    { id, userId }: OwnedSpeciesInput,
    client: Prisma.TransactionClient,
  ): Promise<boolean> {
    const locked = await client.$queryRaw<{ id: string }[]>`
      SELECT id FROM species
      WHERE id = ${id}::uuid AND (user_id IS NULL OR user_id = ${userId}::uuid)
      FOR KEY SHARE
    `;
    return locked.length > 0;
  }

  async reassignReferences(
    { sourceId, targetId, userId }: { sourceId: string; targetId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SpeciesMergeResult["reassigned"]> {
    const characters = await client.$executeRaw`
      UPDATE characters
      SET species_id = ${targetId}::uuid
      WHERE species_id = ${sourceId}::uuid AND user_id = ${userId}::uuid
    `;
    const bookOverrides = await client.$executeRaw`
      UPDATE book_characters
      SET species_override_id = ${targetId}::uuid
      WHERE species_override_id = ${sourceId}::uuid
        AND character_id IN (SELECT id FROM characters WHERE user_id = ${userId}::uuid)
    `;
    return { bookOverrides, characters };
  }

  renameCustom(
    {
      id,
      name,
      normalizedName,
      userId,
    }: { id: string; name: string; normalizedName: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SpeciesWithNames> {
    return client.species.update({
      data: { name, normalizedName },
      where: { id, userId },
      ...speciesWithNamesArgs,
    });
  }

  searchVisible(
    { normalizedQuery, userId }: { normalizedQuery: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SpeciesWithNames[]> {
    const contains = escapeLikePattern(normalizedQuery);
    return client.species.findMany({
      where: {
        AND: [
          visibleToUser(userId),
          {
            OR: [
              { normalizedName: { contains } },
              { names: { some: { normalizedName: { contains } } } },
            ],
          },
        ],
      },
      ...speciesWithNamesArgs,
    });
  }
}

function countsBySpecies(rows: readonly CountedRow[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.speciesId !== null) {
      counts.set(row.speciesId, row.count);
    }
  }
  return counts;
}
