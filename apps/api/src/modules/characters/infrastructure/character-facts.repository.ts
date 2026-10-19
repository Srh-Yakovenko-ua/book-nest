import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { CharacterFactModel } from "../../../generated/prisma/models.js";

import { acquireSharedAdvisoryLock } from "../../../core/database/advisory-lock.js";
import { escapeLikePattern } from "../../../core/database/like-pattern.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { characterMergeLockFor } from "./character-merge-lock.js";

export type ActiveAppearanceRow = {
  bookCharacterId: string;
  pagesCount: Nullable<number>;
};

export type CharacterFactData = {
  chapter: Nullable<string>;
  page: Nullable<number>;
  text: string;
  title: string;
};

export type CharacterFactPatch = Partial<CharacterFactData>;

export type FactListScope = {
  bookCharacterId: string;
  search: string | undefined;
};

type FactInAppearance = {
  bookCharacterId: string;
  factId: string;
};

const FACT_LIST_ORDER_BY: Prisma.CharacterFactOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];

@Injectable()
export class CharacterFactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireMergeGuard(
    { userId }: { userId: string },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await acquireSharedAdvisoryLock(characterMergeLockFor(userId), client);
  }

  countFacts(
    scope: FactListScope,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.characterFact.count({ where: buildFactsWhere(scope) });
  }

  createFact(
    { bookCharacterId, data }: { bookCharacterId: string; data: CharacterFactData },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterFactModel> {
    return client.characterFact.create({ data: { ...data, bookCharacterId } });
  }

  async deleteFact(
    { bookCharacterId, factId }: FactInAppearance,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.characterFact.deleteMany({
      where: { bookCharacterId, id: factId },
    });
    return result.count;
  }

  async findActiveAppearance(
    { bookId, characterId, userId }: { bookId: string; characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<ActiveAppearanceRow>> {
    const appearance = await client.bookCharacter.findFirst({
      select: { book: { select: { pagesCount: true } }, id: true },
      where: {
        book: { ...SOFT_DELETE_SCOPE.active, userId },
        bookId,
        character: { ...SOFT_DELETE_SCOPE.active, userId },
        characterId,
      },
    });
    if (appearance === null) {
      return null;
    }
    return { bookCharacterId: appearance.id, pagesCount: appearance.book.pagesCount };
  }

  listFacts(
    { scope, skip, take }: { scope: FactListScope; skip: number; take: number },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterFactModel[]> {
    return client.characterFact.findMany({
      orderBy: FACT_LIST_ORDER_BY,
      skip,
      take,
      where: buildFactsWhere(scope),
    });
  }

  updateFact(
    { bookCharacterId, data, factId }: FactInAppearance & { data: CharacterFactPatch },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterFactModel> {
    return client.characterFact.update({ data, where: { bookCharacterId, id: factId } });
  }
}

function buildFactsWhere({
  bookCharacterId,
  search,
}: FactListScope): Prisma.CharacterFactWhereInput {
  if (search === undefined) {
    return { bookCharacterId };
  }
  const contains = { contains: escapeLikePattern(search), mode: "insensitive" } as const;
  return { bookCharacterId, OR: [{ title: contains }, { text: contains }] };
}
