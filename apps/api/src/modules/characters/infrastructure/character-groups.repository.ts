import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  CharacterGroupMembershipModel,
  CharacterGroupModel,
} from "../../../generated/prisma/models.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

const detailsInclude = {
  memberships: {
    include: { character: { select: { hideProfileAsSpoiler: true, id: true, name: true } } },
    orderBy: [{ createdAt: "asc" }],
    where: { character: { deletedAt: null } },
  },
} satisfies Prisma.CharacterGroupInclude;

const summaryInclude = {
  _count: { select: { memberships: true } },
} satisfies Prisma.CharacterGroupInclude;

const graphMembershipSelect = {
  bookId: true,
  characterId: true,
  group: { select: { id: true, isSpoiler: true, name: true, type: true } },
  isSpoiler: true,
} satisfies Prisma.CharacterGroupMembershipSelect;

export type CharacterGroupDetailsRow = Prisma.CharacterGroupGetPayload<{
  include: typeof detailsInclude;
}>;

export type CharacterGroupSummaryRow = Prisma.CharacterGroupGetPayload<{
  include: typeof summaryInclude;
}>;

export type ContextCharacterPresence = {
  hiddenPresenceCharacterIds: string[];
  revealedCharacterIds: string[];
};

export type CreateGroupData = {
  customType: Nullable<string>;
  description: Nullable<string>;
  isSpoiler: boolean;
  name: string;
  normalizedName: string;
  seriesId: Nullable<string>;
  type: string;
  userId: string;
};

export type CreateMembershipData = {
  bookId: Nullable<string>;
  characterId: string;
  groupId: string;
  isSpoiler: boolean;
  role: Nullable<string>;
  status: Nullable<string>;
};

export type GraphMembershipRow = Prisma.CharacterGroupMembershipGetPayload<{
  select: typeof graphMembershipSelect;
}>;

export type GroupListFilter = {
  search: string | undefined;
  seriesId: string | undefined;
  type: string | undefined;
  userId: string;
};

export type UpdateGroupData = {
  customType?: Nullable<string>;
  description?: Nullable<string>;
  isSpoiler?: boolean;
  name?: string;
  normalizedName?: string;
  seriesId?: Nullable<string>;
  type?: string;
};

export type UpdateMembershipData = {
  isSpoiler: boolean;
  role: Nullable<string>;
  status: Nullable<string>;
};

@Injectable()
export class CharacterGroupsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireMembershipLock(
    {
      bookId,
      characterId,
      groupId,
    }: { bookId: Nullable<string>; characterId: string; groupId: string },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const key = `cgm:${groupId}:${characterId}:${bookId ?? "global"}`;
    await acquireAdvisoryLock({ classId: ADVISORY_LOCK_CLASS.characterGroups, key }, client);
  }

  async countOwnedCharacters(
    { characterIds, userId }: { characterIds: string[]; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    return client.character.count({
      where: { deletedAt: null, id: { in: characterIds }, userId },
    });
  }

  countOwnedGroups(filter: GroupListFilter): Promise<number> {
    return this.prisma.characterGroup.count({ where: buildGroupWhere(filter) });
  }

  createGroup(
    data: CreateGroupData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterGroupModel> {
    return client.characterGroup.create({ data });
  }

  createMembership(
    data: CreateMembershipData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterGroupMembershipModel> {
    return client.characterGroupMembership.create({ data });
  }

  async createMemberships(
    rows: CreateMembershipData[],
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await client.characterGroupMembership.createMany({ data: rows });
  }

  async deleteMembershipsByCharacter(
    { characterId, groupId }: { characterId: string; groupId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const result = await client.characterGroupMembership.deleteMany({
      where: { characterId, groupId },
    });
    return result.count;
  }

  async deleteOwnedGroup({
    groupId,
    userId,
  }: {
    groupId: string;
    userId: string;
  }): Promise<number> {
    const result = await this.prisma.characterGroup.deleteMany({ where: { id: groupId, userId } });
    return result.count;
  }

  findMembership(
    {
      bookId,
      characterId,
      groupId,
    }: { bookId: Nullable<string>; characterId: string; groupId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CharacterGroupMembershipModel>> {
    return client.characterGroupMembership.findFirst({ where: { bookId, characterId, groupId } });
  }

  findOwnedGroupBare(
    { groupId, userId }: { groupId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CharacterGroupModel>> {
    return client.characterGroup.findFirst({ where: { id: groupId, userId } });
  }

  findOwnedGroupDetails(
    { groupId, userId }: { groupId: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CharacterGroupDetailsRow>> {
    return client.characterGroup.findFirst({
      include: detailsInclude,
      where: { id: groupId, userId },
    });
  }

  listGraphMemberships({
    characterIds,
    userId,
  }: {
    characterIds: string[];
    userId: string;
  }): Promise<GraphMembershipRow[]> {
    if (characterIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.characterGroupMembership.findMany({
      select: graphMembershipSelect,
      where: { characterId: { in: characterIds }, group: { userId } },
    });
  }

  async listMembershipPresence({
    allowedBookIds,
    characterIds,
    userId,
  }: {
    allowedBookIds: string[];
    characterIds: string[];
    userId: string;
  }): Promise<ContextCharacterPresence> {
    if (characterIds.length === 0) {
      return { hiddenPresenceCharacterIds: [], revealedCharacterIds: [] };
    }
    const scope = { deletedAt: null, userId };
    const [revealed, hidden] = await Promise.all([
      allowedBookIds.length === 0
        ? []
        : this.prisma.bookCharacter.findMany({
            distinct: ["characterId"],
            select: { characterId: true },
            where: {
              bookId: { in: allowedBookIds },
              character: scope,
              characterId: { in: characterIds },
              hidePresenceAsSpoiler: false,
            },
          }),
      this.prisma.bookCharacter.findMany({
        distinct: ["characterId"],
        select: { characterId: true },
        where: { character: scope, characterId: { in: characterIds }, hidePresenceAsSpoiler: true },
      }),
    ]);
    return {
      hiddenPresenceCharacterIds: hidden.map((row) => row.characterId),
      revealedCharacterIds: revealed.map((row) => row.characterId),
    };
  }

  listOwnedGroups({
    filter,
    skip,
    take,
  }: {
    filter: GroupListFilter;
    skip: number;
    take: number;
  }): Promise<CharacterGroupSummaryRow[]> {
    return this.prisma.characterGroup.findMany({
      include: summaryInclude,
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
      skip,
      take,
      where: buildGroupWhere(filter),
    });
  }

  updateGroup(
    { data, groupId }: { data: UpdateGroupData; groupId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterGroupModel> {
    return client.characterGroup.update({ data, where: { id: groupId } });
  }

  updateMembership(
    { data, id }: { data: UpdateMembershipData; id: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterGroupMembershipModel> {
    return client.characterGroupMembership.update({ data, where: { id } });
  }
}

function buildGroupWhere(filter: GroupListFilter): Prisma.CharacterGroupWhereInput {
  const { search, seriesId, type, userId } = filter;
  const where: Prisma.CharacterGroupWhereInput = {
    OR: [{ seriesId: null }, { series: SOFT_DELETE_SCOPE.active }],
    userId,
  };
  if (seriesId !== undefined) {
    where.seriesId = seriesId;
  }
  if (type !== undefined) {
    where.type = type;
  }
  if (search !== undefined) {
    where.name = { contains: search, mode: "insensitive" };
  }
  return where;
}
