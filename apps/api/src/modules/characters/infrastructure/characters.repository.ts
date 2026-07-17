import type { Nullable } from "@app/shared";

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

export type CharacterDetailsRow = Prisma.CharacterGetPayload<{ include: typeof detailsInclude }>;

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

export type RosterRow = Prisma.BookCharacterGetPayload<{ include: typeof rosterInclude }>;

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

  findOwnedBookCharacter(
    { bookId, characterId, userId }: { bookId: string; characterId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<BookCharacterModel>> {
    return client.bookCharacter.findFirst({
      where: { bookId, character: { deletedAt: null, userId }, characterId },
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

  listRoster({ skip, take, ...filter }: ListRosterInput): Promise<RosterRow[]> {
    return this.prisma.bookCharacter.findMany({
      include: rosterInclude,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      skip,
      take,
      where: buildRosterWhere(filter),
    });
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
    where.OR = [{ character: { name: contains } }, { displayName: contains }];
  }

  return where;
}
