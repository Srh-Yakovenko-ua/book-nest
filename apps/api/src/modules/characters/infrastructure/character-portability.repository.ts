import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  CharacterImportPlan,
  ExportCharacterRow,
  ExportGroupRow,
  ExportRelationshipRow,
  ExportTheoryRow,
} from "../domain/character-portability.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const aliasSelect = {
  bookId: true,
  isSpoiler: true,
  name: true,
  position: true,
  type: true,
} satisfies Prisma.CharacterAliasSelect;

const roleSelect = {
  customRole: true,
  isSpoiler: true,
  position: true,
  roleType: true,
} satisfies Prisma.BookCharacterRoleSelect;

const appearanceSelect = {
  appearanceNotes: true,
  appearanceNotesIsSpoiler: true,
  attitude: true,
  bookId: true,
  description: true,
  descriptionIsSpoiler: true,
  displayName: true,
  displayNameIsSpoiler: true,
  firstAppearanceAudioSeconds: true,
  firstAppearanceChapter: true,
  firstAppearanceNote: true,
  firstAppearancePage: true,
  hidePresenceAsSpoiler: true,
  importance: true,
  isPovCharacter: true,
  narratorType: true,
  personalImpression: true,
  personalImpressionIsSpoiler: true,
  portraitIsSpoiler: true,
  portraitMediaId: true,
  roles: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: roleSelect },
  sortOrder: true,
  speciesOverride: true,
  speciesOverrideIsSpoiler: true,
  status: true,
  statusCustomText: true,
  statusIsSpoiler: true,
} satisfies Prisma.BookCharacterSelect;

const characterSelect = {
  aliases: { orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: aliasSelect },
  archivedAt: true,
  avatarMediaId: true,
  bookAppearances: { orderBy: [{ createdAt: "asc" }], select: appearanceSelect },
  customGender: true,
  entityKind: true,
  gender: true,
  globalAttitude: true,
  hideProfileAsSpoiler: true,
  id: true,
  isFavorite: true,
  name: true,
  neutralDescription: true,
  pronouns: true,
  species: true,
  tags: { orderBy: [{ tagId: "asc" }], select: { tagId: true } },
} satisfies Prisma.CharacterSelect;

const membershipSelect = {
  bookId: true,
  characterId: true,
  isSpoiler: true,
  role: true,
  status: true,
} satisfies Prisma.CharacterGroupMembershipSelect;

const bookStateSelect = {
  bookId: true,
  description: true,
  endedAudioSeconds: true,
  endedChapter: true,
  endedPage: true,
  hideRelationshipAsSpoiler: true,
  intensity: true,
  introducedAudioSeconds: true,
  introducedChapter: true,
  introducedPage: true,
  isDescriptionSpoiler: true,
  isTypeSpoiler: true,
  status: true,
} satisfies Prisma.CharacterRelationshipBookStateSelect;

@Injectable()
export class CharacterPortabilityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOwnedBookIds({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<Set<string>> {
    if (bookIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.book.findMany({
      select: { id: true },
      where: { id: { in: bookIds }, userId },
    });
    return new Set(rows.map((row) => row.id));
  }

  async findOwnedMediaIds({
    mediaIds,
    userId,
  }: {
    mediaIds: string[];
    userId: string;
  }): Promise<Set<string>> {
    if (mediaIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.mediaAsset.findMany({
      select: { id: true },
      where: { id: { in: mediaIds }, userId },
    });
    return new Set(rows.map((row) => row.id));
  }

  async findOwnedSeriesIds({
    seriesIds,
    userId,
  }: {
    seriesIds: string[];
    userId: string;
  }): Promise<Set<string>> {
    if (seriesIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.series.findMany({
      select: { id: true },
      where: { id: { in: seriesIds }, userId },
    });
    return new Set(rows.map((row) => row.id));
  }

  async findOwnedTagIds({
    tagIds,
    userId,
  }: {
    tagIds: string[];
    userId: string;
  }): Promise<Set<string>> {
    if (tagIds.length === 0) {
      return new Set();
    }
    const rows = await this.prisma.tag.findMany({
      select: { id: true },
      where: { id: { in: tagIds }, userId },
    });
    return new Set(rows.map((row) => row.id));
  }

  async insertGraph(plan: CharacterImportPlan, client: Prisma.TransactionClient): Promise<void> {
    if (plan.characters.length > 0) {
      await client.character.createMany({ data: plan.characters });
    }
    if (plan.aliases.length > 0) {
      await client.characterAlias.createMany({ data: plan.aliases });
    }
    if (plan.bookCharacters.length > 0) {
      await client.bookCharacter.createMany({ data: plan.bookCharacters });
    }
    if (plan.roles.length > 0) {
      await client.bookCharacterRole.createMany({ data: plan.roles });
    }
    if (plan.characterTags.length > 0) {
      await client.characterTag.createMany({ data: plan.characterTags });
    }
    if (plan.groups.length > 0) {
      await client.characterGroup.createMany({ data: plan.groups });
    }
    if (plan.memberships.length > 0) {
      await client.characterGroupMembership.createMany({ data: plan.memberships });
    }
    if (plan.relationships.length > 0) {
      await client.characterRelationship.createMany({ data: plan.relationships });
    }
    if (plan.bookStates.length > 0) {
      await client.characterRelationshipBookState.createMany({ data: plan.bookStates });
    }
    if (plan.theories.length > 0) {
      await client.characterTheory.createMany({ data: plan.theories });
    }
  }

  loadCharacters({
    includeArchived,
    userId,
  }: {
    includeArchived: boolean;
    userId: string;
  }): Promise<ExportCharacterRow[]> {
    return this.prisma.character.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: characterSelect,
      where: characterScope({ includeArchived, userId }),
    });
  }

  loadGroups({
    includeArchived,
    userId,
  }: {
    includeArchived: boolean;
    userId: string;
  }): Promise<ExportGroupRow[]> {
    return this.prisma.characterGroup.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        customType: true,
        description: true,
        isSpoiler: true,
        memberships: {
          orderBy: [{ createdAt: "asc" }],
          select: membershipSelect,
          where: { character: characterScope({ includeArchived }) },
        },
        name: true,
        seriesId: true,
        type: true,
      },
      where: { userId },
    });
  }

  loadRelationships({
    includeArchived,
    userId,
  }: {
    includeArchived: boolean;
    userId: string;
  }): Promise<ExportRelationshipRow[]> {
    return this.prisma.characterRelationship.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        bookStates: { orderBy: [{ createdAt: "asc" }], select: bookStateSelect },
        category: true,
        customType: true,
        directionality: true,
        isCanonical: true,
        sourceCharacterId: true,
        sourceLabel: true,
        targetCharacterId: true,
        targetLabel: true,
        type: true,
      },
      where: {
        sourceCharacter: characterScope({ includeArchived }),
        targetCharacter: characterScope({ includeArchived }),
        userId,
      },
    });
  }

  loadTheories({
    includeArchived,
    userId,
  }: {
    includeArchived: boolean;
    userId: string;
  }): Promise<ExportTheoryRow[]> {
    return this.prisma.characterTheory.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        bookId: true,
        characterId: true,
        isSpoiler: true,
        seriesId: true,
        status: true,
        text: true,
      },
      where: {
        OR: [{ characterId: null }, { character: characterScope({ includeArchived }) }],
        userId,
      },
    });
  }
}

function characterScope({
  includeArchived,
  userId,
}: {
  includeArchived: boolean;
  userId?: string;
}): Prisma.CharacterWhereInput {
  const where: Prisma.CharacterWhereInput = { deletedAt: null };
  if (!includeArchived) {
    where.archivedAt = null;
  }
  if (userId !== undefined) {
    where.userId = userId;
  }
  return where;
}
