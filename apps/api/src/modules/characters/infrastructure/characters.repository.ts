import type { CharacterListSort, Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { BookCharacterModel, CharacterModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const detailsInclude = {
  aliases: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
  avatarMedia: true,
  bookAppearances: {
    include: {
      portraitMedia: true,
      roles: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.CharacterInclude;

const rosterInclude = {
  character: {
    select: { avatarMedia: true, entityKind: true, id: true, isFavorite: true, name: true },
  },
  portraitMedia: true,
} satisfies Prisma.BookCharacterInclude;

const globalSummaryInclude = {
  _count: { select: { bookAppearances: true } },
  avatarMedia: true,
  tags: {
    orderBy: [{ tag: { name: "asc" } }, { tag: { normalizedName: "asc" } }],
    select: { tag: { select: { id: true, name: true } } },
  },
} satisfies Prisma.CharacterInclude;

const seriesAppearanceInclude = {
  book: { select: { id: true, partNumber: true } },
  character: {
    select: { avatarMedia: true, entityKind: true, id: true, isFavorite: true, name: true },
  },
  portraitMedia: true,
} satisfies Prisma.BookCharacterInclude;

const seriesProfileInclude = {
  aliases: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
  avatarMedia: true,
  bookAppearances: {
    include: {
      portraitMedia: true,
      roles: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
    },
    orderBy: [{ createdAt: "asc" }],
  },
} satisfies Prisma.CharacterInclude;

const purgeSelect = {
  avatarMediaId: true,
  bookAppearances: { select: { portraitMediaId: true } },
  deletedAt: true,
} satisfies Prisma.CharacterSelect;

const graphNodeSelect = {
  entityKind: true,
  id: true,
  isFavorite: true,
  name: true,
  updatedAt: true,
} satisfies Prisma.CharacterSelect;

const GLOBAL_CHARACTER_ORDER_BY: Record<
  CharacterListSort,
  Prisma.CharacterOrderByWithRelationInput[]
> = {
  name: [{ name: "asc" }, { createdAt: "asc" }],
  recently_added: [{ createdAt: "desc" }, { name: "asc" }],
  recently_updated: [{ updatedAt: "desc" }, { name: "asc" }],
};

export type BookCharacterSummaryAggregate = {
  byImportance: { count: number; importance: string }[];
  favoritesCount: number;
  hiddenCount: number;
  povCount: number;
  totalVisibleCharacters: number;
};

export type BookContextRow = {
  id: string;
  partNumber: Nullable<number>;
  seriesId: Nullable<string>;
};

export type CharacterDeletionImpact = {
  aliasCount: number;
  appearanceCount: number;
  roleCount: number;
  tagCount: number;
};

export type CharacterDetailsRow = Prisma.CharacterGetPayload<{ include: typeof detailsInclude }>;

export type CharacterDuplicateSignals = {
  aliases: { normalizedName: string }[];
  bookAppearances: { book: { seriesId: Nullable<string> } }[];
  name: string;
  normalizedName: string;
};

export type CharacterGlobalSummaryRow = Prisma.CharacterGetPayload<{
  include: typeof globalSummaryInclude;
}>;

export type CharacterPurgeRow = Prisma.CharacterGetPayload<{ select: typeof purgeSelect }>;

export type CharacterSeriesProfileRow = Prisma.CharacterGetPayload<{
  include: typeof seriesProfileInclude;
}>;

export type CreateAliasData = {
  bookId: Nullable<string>;
  isSpoiler: boolean;
  name: string;
  normalizedName: string;
  position: number;
  type: string;
};

export type CreateBookCharacterData = {
  appearanceNotes: Nullable<string>;
  appearanceNotesIsSpoiler: boolean;
  attitude: Nullable<string>;
  bookId: string;
  characterId: string;
  description: Nullable<string>;
  descriptionIsSpoiler: boolean;
  displayName: Nullable<string>;
  displayNameIsSpoiler: boolean;
  firstAppearanceAudioSeconds: Nullable<number>;
  firstAppearanceChapter: Nullable<string>;
  firstAppearanceNote: Nullable<string>;
  firstAppearancePage: Nullable<number>;
  hidePresenceAsSpoiler: boolean;
  importance: string;
  isPovCharacter: boolean;
  narratorType: Nullable<string>;
  personalImpression: Nullable<string>;
  personalImpressionIsSpoiler: boolean;
  portraitIsSpoiler: boolean;
  portraitMediaId: Nullable<string>;
  roles: CreateRoleData[];
  sortOrder: Nullable<number>;
  speciesOverride: Nullable<string>;
  speciesOverrideIsSpoiler: boolean;
  status: string;
  statusCustomText: Nullable<string>;
  statusIsSpoiler: boolean;
};

export type CreateCharacterData = {
  aliases: CreateAliasData[];
  avatarMediaId: Nullable<string>;
  customGender: Nullable<string>;
  entityKind: string;
  gender: string;
  globalAttitude: Nullable<string>;
  isFavorite: boolean;
  name: string;
  neutralDescription: Nullable<string>;
  normalizedName: string;
  pronouns: Nullable<string>;
  species: Nullable<string>;
  userId: string;
};

export type CreateRoleData = {
  customRole: Nullable<string>;
  isSpoiler: boolean;
  position: number;
  roleType: string;
};

export type GlobalCharacterFilter = {
  archived: boolean;
  attitudes: string[] | undefined;
  bookId: string | undefined;
  contextBookId: string | undefined;
  duplicateNormalizedNames: string[] | undefined;
  favorite: boolean | undefined;
  genders: string[] | undefined;
  groupIds: string[] | undefined;
  hasSpoilers: boolean | undefined;
  importances: string[] | undefined;
  includeSpoilerSearch: boolean;
  roleTypes: string[] | undefined;
  search: string | undefined;
  seriesId: string | undefined;
  species: string[] | undefined;
  tagIds: string[] | undefined;
  userId: string;
};

export type GraphNodeRow = {
  bookAppearances: {
    bookId: string;
    createdAt: Date;
    hidePresenceAsSpoiler: boolean;
    importance: string;
  }[];
  entityKind: string;
  id: string;
  isFavorite: boolean;
  name: string;
  updatedAt: Date;
};

export type RosterRow = Prisma.BookCharacterGetPayload<{ include: typeof rosterInclude }>;

export type SeriesAppearanceRow = Prisma.BookCharacterGetPayload<{
  include: typeof seriesAppearanceInclude;
}>;

export type SeriesBookRow = {
  createdAt: Date;
  id: string;
  partNumber: Nullable<number>;
};

export type SeriesReadingContextBookRow = {
  createdAt: Date;
  id: string;
  partNumber: Nullable<number>;
  readingProgress: Nullable<{ finishedAt: Nullable<Date> }>;
};

export type UpdateBookCharacterData = {
  appearanceNotes?: Nullable<string>;
  appearanceNotesIsSpoiler?: boolean;
  attitude?: Nullable<string>;
  description?: Nullable<string>;
  descriptionIsSpoiler?: boolean;
  displayName?: Nullable<string>;
  displayNameIsSpoiler?: boolean;
  firstAppearanceAudioSeconds?: Nullable<number>;
  firstAppearanceChapter?: Nullable<string>;
  firstAppearanceNote?: Nullable<string>;
  firstAppearancePage?: Nullable<number>;
  hidePresenceAsSpoiler?: boolean;
  importance?: string;
  isPovCharacter?: boolean;
  narratorType?: Nullable<string>;
  personalImpression?: Nullable<string>;
  personalImpressionIsSpoiler?: boolean;
  portraitIsSpoiler?: boolean;
  portraitMediaId?: Nullable<string>;
  sortOrder?: Nullable<number>;
  speciesOverride?: Nullable<string>;
  speciesOverrideIsSpoiler?: boolean;
  status?: string;
  statusCustomText?: Nullable<string>;
  statusIsSpoiler?: boolean;
};

export type UpdateCharacterData = {
  avatarMediaId?: Nullable<string>;
  customGender?: Nullable<string>;
  entityKind?: string;
  gender?: string;
  globalAttitude?: Nullable<string>;
  isFavorite?: boolean;
  name?: string;
  neutralDescription?: Nullable<string>;
  normalizedName?: string;
  pronouns?: Nullable<string>;
  species?: Nullable<string>;
};

type ListRosterInput = RosterFilter & {
  skip: number;
  take: number;
};

type RosterFilter = {
  bookId: string;
  search: string | undefined;
  userId: string;
};

@Injectable()
export class CharactersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async aggregateBookCharacterSummary({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<BookCharacterSummaryAggregate> {
    const characterScope = { deletedAt: null, userId };
    const visibleWhere: Prisma.BookCharacterWhereInput = {
      bookId,
      character: characterScope,
      hidePresenceAsSpoiler: false,
    };

    const [totalVisibleCharacters, povCount, favoritesCount, hiddenCount, byImportanceRows] =
      await Promise.all([
        this.prisma.bookCharacter.count({ where: visibleWhere }),
        this.prisma.bookCharacter.count({ where: { ...visibleWhere, isPovCharacter: true } }),
        this.prisma.bookCharacter.count({
          where: { ...visibleWhere, character: { ...characterScope, isFavorite: true } },
        }),
        this.prisma.bookCharacter.count({
          where: { bookId, character: characterScope, hidePresenceAsSpoiler: true },
        }),
        this.prisma.bookCharacter.groupBy({
          _count: { _all: true },
          by: ["importance"],
          where: visibleWhere,
        }),
      ]);

    return {
      byImportance: byImportanceRows.map((row) => ({
        count: row._count._all,
        importance: row.importance,
      })),
      favoritesCount,
      hiddenCount,
      povCount,
      totalVisibleCharacters,
    };
  }

  async countDeletionImpact(
    { characterId }: { characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterDeletionImpact> {
    const [appearanceCount, roleCount, aliasCount, tagCount] = await Promise.all([
      client.bookCharacter.count({ where: { characterId } }),
      client.bookCharacterRole.count({ where: { bookCharacter: { characterId } } }),
      client.characterAlias.count({ where: { characterId } }),
      client.characterTag.count({ where: { characterId } }),
    ]);
    return { aliasCount, appearanceCount, roleCount, tagCount };
  }

  countGlobalSummaries(filter: GlobalCharacterFilter): Promise<number> {
    return this.prisma.character.count({ where: buildGlobalCharacterWhere(filter) });
  }

  countRoster(filter: RosterFilter): Promise<number> {
    return this.prisma.bookCharacter.count({ where: buildRosterWhere(filter) });
  }

  createBookCharacter(
    data: CreateBookCharacterData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookCharacterModel> {
    const { roles, ...rest } = data;
    return client.bookCharacter.create({
      data: { ...rest, roles: { create: roles.map((role) => ({ ...role })) } },
    });
  }

  createCharacter(
    data: CreateCharacterData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterModel> {
    const { aliases, ...rest } = data;
    return client.character.create({
      data: { ...rest, aliases: { create: aliases.map((alias) => ({ ...alias })) } },
    });
  }

  async deleteBookCharacter(
    { bookCharacterId }: { bookCharacterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.bookCharacter.delete({ where: { id: bookCharacterId } });
  }

  async existsLink(
    { bookId, characterId }: { bookId: string; characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<boolean> {
    const found = await client.bookCharacter.findUnique({
      select: { id: true },
      where: { bookId_characterId: { bookId, characterId } },
    });
    return found !== null;
  }

  async existsOwnedSeries({
    seriesId,
    userId,
  }: {
    seriesId: string;
    userId: string;
  }): Promise<boolean> {
    const found = await this.prisma.series.findFirst({
      select: { id: true },
      where: { id: seriesId, userId },
    });
    return found !== null;
  }

  findCharacterDuplicateSignals({
    characterId,
    userId,
  }: {
    characterId: string;
    userId: string;
  }): Promise<Nullable<CharacterDuplicateSignals>> {
    return this.prisma.character.findFirst({
      select: {
        aliases: { select: { normalizedName: true } },
        bookAppearances: { select: { book: { select: { seriesId: true } } } },
        name: true,
        normalizedName: true,
      },
      where: { deletedAt: null, id: characterId, userId },
    });
  }

  findDuplicateCandidates({
    excludeCharacterId,
    limit,
    normalizedNames,
    seriesIds,
    similarName,
    userId,
  }: {
    excludeCharacterId: string | undefined;
    limit: number;
    normalizedNames: string[];
    seriesIds: string[];
    similarName: string | undefined;
    userId: string;
  }): Promise<CharacterGlobalSummaryRow[]> {
    const or: Prisma.CharacterWhereInput[] = [];
    if (normalizedNames.length > 0) {
      or.push({ normalizedName: { in: normalizedNames } });
      or.push({ aliases: { some: { normalizedName: { in: normalizedNames } } } });
    }
    if (seriesIds.length > 0 && similarName !== undefined) {
      or.push({
        AND: [
          { name: { contains: similarName, mode: "insensitive" } },
          { bookAppearances: { some: { book: { seriesId: { in: seriesIds } } } } },
        ],
      });
    }
    if (or.length === 0) {
      return Promise.resolve([]);
    }

    const where: Prisma.CharacterWhereInput = { deletedAt: null, OR: or, userId };
    if (excludeCharacterId !== undefined) {
      where.id = { not: excludeCharacterId };
    }
    return this.prisma.character.findMany({
      include: globalSummaryInclude,
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      take: limit,
      where,
    });
  }

  async findDuplicateNormalizedNames({
    archived,
    userId,
  }: {
    archived: boolean;
    userId: string;
  }): Promise<string[]> {
    const groups = await this.prisma.character.groupBy({
      _count: { normalizedName: true },
      by: ["normalizedName"],
      having: { normalizedName: { _count: { gt: 1 } } },
      where: { archivedAt: archived ? { not: null } : null, deletedAt: null, userId },
    });
    return groups.map((group) => group.normalizedName);
  }

  findForPurge(
    { characterId, userId }: { characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CharacterPurgeRow>> {
    return client.character.findFirst({
      select: purgeSelect,
      where: { id: characterId, userId },
    });
  }

  findOwnedBookCharacter(
    { bookId, characterId, userId }: { bookId: string; characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookCharacterModel>> {
    return client.bookCharacter.findFirst({
      where: { bookId, character: { deletedAt: null, userId }, characterId },
    });
  }

  findOwnedBookContext({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<Nullable<BookContextRow>> {
    return this.prisma.book.findFirst({
      select: { id: true, partNumber: true, seriesId: true },
      where: { id: bookId, userId },
    });
  }

  findOwnedCharacterBare(
    { characterId, userId }: { characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CharacterModel>> {
    return client.character.findFirst({ where: { deletedAt: null, id: characterId, userId } });
  }

  findOwnedCharacterDetails(
    { bookId, characterId, userId }: { bookId?: string; characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CharacterDetailsRow>> {
    return client.character.findFirst({
      include: {
        ...detailsInclude,
        bookAppearances: {
          ...detailsInclude.bookAppearances,
          where: bookId === undefined ? undefined : { bookId },
        },
      },
      where: { deletedAt: null, id: characterId, userId },
    });
  }

  findOwnedCharacterDetailsInBooks(
    {
      allowedBookIds,
      characterId,
      userId,
    }: { allowedBookIds: string[]; characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CharacterDetailsRow>> {
    return client.character.findFirst({
      include: {
        ...detailsInclude,
        bookAppearances: {
          ...detailsInclude.bookAppearances,
          where: { bookId: { in: allowedBookIds } },
        },
      },
      where: { deletedAt: null, id: characterId, userId },
    });
  }

  findSeriesCharacterProfile(
    {
      allowedBookIds,
      characterId,
      userId,
    }: { allowedBookIds: string[]; characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CharacterSeriesProfileRow>> {
    return client.character.findFirst({
      include: {
        ...seriesProfileInclude,
        bookAppearances: {
          ...seriesProfileInclude.bookAppearances,
          where: { bookId: { in: allowedBookIds }, hidePresenceAsSpoiler: false },
        },
      },
      where: { deletedAt: null, id: characterId, userId },
    });
  }

  async hardDeleteIfDeleted(
    { characterId, userId }: { characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.character.deleteMany({
      where: { deletedAt: { not: null }, id: characterId, userId },
    });
    return result.count;
  }

  listGlobalSummaries({
    filter,
    skip,
    sort,
    take,
  }: {
    filter: GlobalCharacterFilter;
    skip: number;
    sort: CharacterListSort;
    take: number;
  }): Promise<CharacterGlobalSummaryRow[]> {
    return this.prisma.character.findMany({
      include: globalSummaryInclude,
      orderBy: GLOBAL_CHARACTER_ORDER_BY[sort],
      skip,
      take,
      where: buildGlobalCharacterWhere(filter),
    });
  }

  listGraphNodes({
    bookIds,
    characterIds,
    userId,
  }: {
    bookIds: string[];
    characterIds: string[];
    userId: string;
  }): Promise<GraphNodeRow[]> {
    if (characterIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.character.findMany({
      select: {
        ...graphNodeSelect,
        bookAppearances: {
          select: { bookId: true, createdAt: true, hidePresenceAsSpoiler: true, importance: true },
          where: { bookId: { in: bookIds } },
        },
      },
      where: { deletedAt: null, id: { in: characterIds }, userId },
    });
  }

  listRoster({ skip, take, ...filter }: ListRosterInput): Promise<RosterRow[]> {
    return this.prisma.bookCharacter.findMany({
      include: rosterInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      skip,
      take,
      where: buildRosterWhere(filter),
    });
  }

  listSeriesAppearances({
    bookIds,
    search,
    userId,
  }: {
    bookIds: string[];
    search: string | undefined;
    userId: string;
  }): Promise<SeriesAppearanceRow[]> {
    const where: Prisma.BookCharacterWhereInput = {
      bookId: { in: bookIds },
      character: { deletedAt: null, userId },
      hidePresenceAsSpoiler: false,
    };
    if (search !== undefined) {
      const contains = { contains: search, mode: "insensitive" } as const;
      where.OR = [
        { character: { name: contains } },
        { displayName: contains, displayNameIsSpoiler: false },
        { character: { aliases: { some: { isSpoiler: false, name: contains } } } },
      ];
    }
    return this.prisma.bookCharacter.findMany({
      include: seriesAppearanceInclude,
      orderBy: [{ createdAt: "asc" }],
      where,
    });
  }

  listSeriesBooks({
    seriesId,
    userId,
  }: {
    seriesId: string;
    userId: string;
  }): Promise<SeriesBookRow[]> {
    return this.prisma.book.findMany({
      orderBy: [{ partNumber: { nulls: "last", sort: "asc" } }, { createdAt: "asc" }],
      select: { createdAt: true, id: true, partNumber: true },
      where: { seriesId, userId },
    });
  }

  listSeriesBooksReadingContext({
    seriesId,
    userId,
  }: {
    seriesId: string;
    userId: string;
  }): Promise<SeriesReadingContextBookRow[]> {
    return this.prisma.book.findMany({
      orderBy: [{ partNumber: { nulls: "last", sort: "asc" } }, { createdAt: "asc" }],
      select: {
        createdAt: true,
        id: true,
        partNumber: true,
        readingProgress: { select: { finishedAt: true } },
      },
      where: { seriesId, userId },
    });
  }

  listSeriesHiddenCharacterIds({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<{ characterId: string }[]> {
    return this.prisma.bookCharacter.findMany({
      distinct: ["characterId"],
      select: { characterId: true },
      where: {
        bookId: { in: bookIds },
        character: { deletedAt: null, userId },
        hidePresenceAsSpoiler: true,
      },
    });
  }

  async listSuggestions({
    bookId,
    limit,
    search,
    seriesId,
    userId,
  }: {
    bookId: string;
    limit: number;
    search: string | undefined;
    seriesId: Nullable<string>;
    userId: string;
  }): Promise<CharacterGlobalSummaryRow[]> {
    const baseWhere: Prisma.CharacterWhereInput = {
      archivedAt: null,
      bookAppearances: { none: { bookId } },
      deletedAt: null,
      userId,
    };
    if (search !== undefined) {
      const contains = { contains: search, mode: "insensitive" } as const;
      baseWhere.OR = [
        { name: contains },
        { aliases: { some: { isSpoiler: false, name: contains } } },
      ];
    }

    const sameSeries =
      seriesId === null
        ? []
        : await this.prisma.character.findMany({
            include: globalSummaryInclude,
            orderBy: [{ name: "asc" }, { createdAt: "asc" }],
            take: limit,
            where: {
              ...baseWhere,
              bookAppearances: { none: { bookId }, some: { book: { seriesId } } },
            },
          });

    const remaining = limit - sameSeries.length;
    if (remaining <= 0) {
      return sameSeries;
    }

    const excludeIds = sameSeries.map((row) => row.id);
    const others = await this.prisma.character.findMany({
      include: globalSummaryInclude,
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      take: remaining,
      where: { ...baseWhere, id: { notIn: excludeIds } },
    });
    return [...sameSeries, ...others];
  }

  async listTopBookCharacters({
    bookId,
    limit,
    userId,
  }: {
    bookId: string;
    limit: number;
    userId: string;
  }): Promise<RosterRow[]> {
    const base: Prisma.BookCharacterWhereInput = {
      bookId,
      character: { deletedAt: null, userId },
      hidePresenceAsSpoiler: false,
    };
    const [central, major] = await Promise.all([
      this.prisma.bookCharacter.findMany({
        include: rosterInclude,
        orderBy: { character: { name: "asc" } },
        take: limit,
        where: { ...base, importance: "central" },
      }),
      this.prisma.bookCharacter.findMany({
        include: rosterInclude,
        orderBy: { character: { name: "asc" } },
        take: limit,
        where: { ...base, importance: "major" },
      }),
    ]);
    return [...central, ...major];
  }

  async replaceAliases(
    {
      aliases,
      bookId,
      characterId,
    }: { aliases: CreateAliasData[]; bookId: Nullable<string>; characterId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.characterAlias.deleteMany({ where: { bookId, characterId } });
    if (aliases.length > 0) {
      await client.characterAlias.createMany({
        data: aliases.map((alias) => ({ ...alias, characterId })),
      });
    }
  }

  async replaceCharacterTags(
    { characterId, tagIds }: { characterId: string; tagIds: string[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.characterTag.deleteMany({ where: { characterId } });
    if (tagIds.length > 0) {
      await client.characterTag.createMany({
        data: tagIds.map((tagId) => ({ characterId, tagId })),
      });
    }
  }

  async replaceRoles(
    { bookCharacterId, roles }: { bookCharacterId: string; roles: CreateRoleData[] },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.bookCharacterRole.deleteMany({ where: { bookCharacterId } });
    if (roles.length > 0) {
      await client.bookCharacterRole.createMany({
        data: roles.map((role) => ({ ...role, bookCharacterId })),
      });
    }
  }

  async restore(
    { characterId, userId }: { characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.character.updateMany({
      data: { deletedAt: null },
      where: { deletedAt: { not: null }, id: characterId, userId },
    });
    return result.count;
  }

  async softDelete(
    { characterId, deletedAt, userId }: { characterId: string; deletedAt: Date; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.character.updateMany({
      data: { deletedAt },
      where: { deletedAt: null, id: characterId, userId },
    });
    return result.count;
  }

  updateBookCharacter(
    { bookCharacterId, data }: { bookCharacterId: string; data: UpdateBookCharacterData },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<BookCharacterModel> {
    return client.bookCharacter.update({ data, where: { id: bookCharacterId } });
  }

  updateCharacter(
    {
      characterId,
      data,
      userId,
    }: { characterId: string; data: UpdateCharacterData; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterModel> {
    return client.character.update({ data, where: { id: characterId, userId } });
  }
}

function buildGlobalCharacterWhere(filter: GlobalCharacterFilter): Prisma.CharacterWhereInput {
  const {
    archived,
    attitudes,
    bookId,
    contextBookId,
    duplicateNormalizedNames,
    favorite,
    genders,
    groupIds,
    hasSpoilers,
    importances,
    includeSpoilerSearch,
    roleTypes,
    search,
    seriesId,
    species,
    tagIds,
    userId,
  } = filter;

  const where: Prisma.CharacterWhereInput = {
    archivedAt: archived ? { not: null } : null,
    deletedAt: null,
    userId,
  };
  if (genders !== undefined) {
    where.gender = { in: genders };
  }
  if (species !== undefined) {
    where.species = { in: species };
  }
  if (attitudes !== undefined) {
    where.globalAttitude = { in: attitudes };
  }
  if (favorite !== undefined) {
    where.isFavorite = favorite;
  }
  if (tagIds !== undefined) {
    where.tags = { some: { tagId: { in: tagIds } } };
  }
  if (duplicateNormalizedNames !== undefined) {
    where.normalizedName = { in: duplicateNormalizedNames };
  }

  const scopeAppearance = (
    extra: Prisma.BookCharacterWhereInput,
  ): Prisma.BookCharacterWhereInput =>
    contextBookId === undefined ? extra : { ...extra, bookId: contextBookId };

  const scopeMembership = (
    extra: Prisma.CharacterGroupMembershipWhereInput,
  ): Prisma.CharacterGroupMembershipWhereInput =>
    contextBookId === undefined
      ? extra
      : { ...extra, OR: [{ bookId: null }, { bookId: contextBookId }] };

  const and: Prisma.CharacterWhereInput[] = [];
  if (importances !== undefined) {
    and.push({ bookAppearances: { some: scopeAppearance({ importance: { in: importances } }) } });
  }
  if (roleTypes !== undefined) {
    and.push({
      bookAppearances: {
        some: scopeAppearance({
          roles: {
            some: {
              roleType: { in: roleTypes },
              ...(includeSpoilerSearch ? {} : { isSpoiler: false }),
            },
          },
        }),
      },
    });
  }
  if (bookId !== undefined) {
    and.push({ bookAppearances: { some: { bookId, hidePresenceAsSpoiler: false } } });
  }
  if (seriesId !== undefined) {
    and.push({
      bookAppearances: { some: { book: { seriesId }, hidePresenceAsSpoiler: false } },
    });
  }
  if (groupIds !== undefined) {
    and.push({
      groupMemberships: {
        some: scopeMembership({
          groupId: { in: groupIds },
          ...(includeSpoilerSearch ? {} : { isSpoiler: false }),
        }),
      },
    });
  }
  if (hasSpoilers !== undefined) {
    const spoilerContent = buildHasSpoilerContentWhere({ scopeAppearance, scopeMembership });
    and.push(hasSpoilers ? spoilerContent : { NOT: spoilerContent });
  }
  if (contextBookId !== undefined) {
    and.push({
      bookAppearances: { none: { bookId: contextBookId, hidePresenceAsSpoiler: true } },
    });
  }
  if (search !== undefined) {
    const contains = { contains: search, mode: "insensitive" } as const;
    and.push({
      OR: [
        { name: contains },
        {
          aliases: {
            some: { name: contains, ...(includeSpoilerSearch ? {} : { isSpoiler: false }) },
          },
        },
        {
          bookAppearances: {
            some: scopeAppearance({
              displayName: contains,
              ...(includeSpoilerSearch ? {} : { displayNameIsSpoiler: false }),
            }),
          },
        },
      ],
    });
  }
  if (and.length > 0) {
    where.AND = and;
  }
  return where;
}

function buildHasSpoilerContentWhere({
  scopeAppearance,
  scopeMembership,
}: {
  scopeAppearance: (extra: Prisma.BookCharacterWhereInput) => Prisma.BookCharacterWhereInput;
  scopeMembership: (
    extra: Prisma.CharacterGroupMembershipWhereInput,
  ) => Prisma.CharacterGroupMembershipWhereInput;
}): Prisma.CharacterWhereInput {
  return {
    OR: [
      { aliases: { some: { isSpoiler: true } } },
      { groupMemberships: { some: scopeMembership({ isSpoiler: true }) } },
      {
        bookAppearances: {
          some: scopeAppearance({
            OR: [
              { appearanceNotesIsSpoiler: true },
              { descriptionIsSpoiler: true },
              { displayNameIsSpoiler: true },
              { hidePresenceAsSpoiler: true },
              { personalImpressionIsSpoiler: true },
              { portraitIsSpoiler: true },
              { speciesOverrideIsSpoiler: true },
              { statusIsSpoiler: true },
              { roles: { some: { isSpoiler: true } } },
            ],
          }),
        },
      },
    ],
  };
}

function buildRosterWhere({
  bookId,
  search,
  userId,
}: RosterFilter): Prisma.BookCharacterWhereInput {
  const where: Prisma.BookCharacterWhereInput = {
    bookId,
    character: { deletedAt: null, userId },
    hidePresenceAsSpoiler: false,
  };

  if (search !== undefined) {
    const contains = { contains: search, mode: "insensitive" } as const;
    where.OR = [
      { character: { name: contains } },
      { displayName: contains, displayNameIsSpoiler: false },
    ];
  }

  return where;
}
