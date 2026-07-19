import type { CharacterTheorySort, Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { THEORY_LIST_ORDER_BY } from "../domain/character-theory-sort.js";

const theoryInclude = {
  book: { select: { id: true, title: true } },
  character: { select: { deletedAt: true, hideProfileAsSpoiler: true, id: true, name: true } },
  series: { select: { id: true, name: true } },
} satisfies Prisma.CharacterTheoryInclude;

export type CharacterTheoryRow = Prisma.CharacterTheoryGetPayload<{
  include: typeof theoryInclude;
}>;

export type CreateTheoryData = {
  bookId: Nullable<string>;
  characterId: Nullable<string>;
  isSpoiler: boolean;
  seriesId: Nullable<string>;
  status: string;
  text: string;
  userId: string;
};

export type TheoryListFilter = {
  bookId: string | undefined;
  characterId: string | undefined;
  contextAllowedBookIds: string[] | undefined;
  search: string | undefined;
  seriesId: string | undefined;
  status: string | undefined;
  userId: string;
};

export type UpdateTheoryData = {
  isSpoiler?: boolean;
  status?: string;
  text?: string;
};

type ListTheoriesInput = {
  filter: TheoryListFilter;
  skip: number;
  sort: CharacterTheorySort;
  take: number;
};

@Injectable()
export class CharacterTheoriesRepository {
  constructor(private readonly prisma: PrismaService) {}

  countTheories(filter: TheoryListFilter): Promise<number> {
    return this.prisma.characterTheory.count({ where: buildTheoriesWhere(filter) });
  }

  create(data: CreateTheoryData): Promise<CharacterTheoryRow> {
    return this.prisma.characterTheory.create({ data, include: theoryInclude });
  }

  async deleteOwned({ theoryId, userId }: { theoryId: string; userId: string }): Promise<number> {
    const result = await this.prisma.characterTheory.deleteMany({
      where: { id: theoryId, userId },
    });
    return result.count;
  }

  findOwnedById({
    theoryId,
    userId,
  }: {
    theoryId: string;
    userId: string;
  }): Promise<Nullable<CharacterTheoryRow>> {
    return this.prisma.characterTheory.findFirst({
      include: theoryInclude,
      where: { id: theoryId, userId },
    });
  }

  listTheories({ filter, skip, sort, take }: ListTheoriesInput): Promise<CharacterTheoryRow[]> {
    return this.prisma.characterTheory.findMany({
      include: theoryInclude,
      orderBy: THEORY_LIST_ORDER_BY[sort],
      skip,
      take,
      where: buildTheoriesWhere(filter),
    });
  }

  update({
    data,
    theoryId,
    userId,
  }: {
    data: UpdateTheoryData;
    theoryId: string;
    userId: string;
  }): Promise<CharacterTheoryRow> {
    return this.prisma.characterTheory.update({
      data,
      include: theoryInclude,
      where: { id: theoryId, userId },
    });
  }
}

function buildTheoriesWhere({
  bookId,
  characterId,
  contextAllowedBookIds,
  search,
  seriesId,
  status,
  userId,
}: TheoryListFilter): Prisma.CharacterTheoryWhereInput {
  const where: Prisma.CharacterTheoryWhereInput = { userId };
  if (characterId !== undefined) {
    where.characterId = characterId;
  }
  if (bookId !== undefined) {
    where.bookId = bookId;
  }
  if (seriesId !== undefined) {
    where.seriesId = seriesId;
  }
  if (status !== undefined) {
    where.status = status;
  }

  const and: Prisma.CharacterTheoryWhereInput[] = [
    { OR: [{ characterId: null }, { character: { hideProfileAsSpoiler: false } }] },
  ];
  if (contextAllowedBookIds !== undefined) {
    where.isSpoiler = false;
    and.push({ OR: [{ bookId: null }, { bookId: { in: contextAllowedBookIds } }] });
  }
  if (search !== undefined) {
    const contains = { contains: search, mode: "insensitive" } as const;
    and.push({
      OR: [
        { text: contains },
        { book: { title: contains } },
        { character: { name: contains } },
        { series: { name: contains } },
      ],
    });
  }
  if (and.length > 0) {
    where.AND = and;
  }
  return where;
}
