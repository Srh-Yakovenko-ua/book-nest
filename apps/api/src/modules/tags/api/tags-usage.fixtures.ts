import type { Nullable } from "@app/shared";

import type { PrismaService } from "../../../core/database/prisma.service.js";

export type TagsUsageFixtures = ReturnType<typeof createTagsUsageFixtures>;

type SeedBookInput = {
  deletedAt?: Date;
  title?: string;
  userId: string;
};

type SeedCharacterInput = {
  archivedAt?: Date;
  deletedAt?: Date;
  hideProfileAsSpoiler?: boolean;
  name: string;
  userId: string;
};

type Seeded = { id: string };

type SeedTagInput = {
  color?: Nullable<string>;
  createdAt?: Date;
  description?: Nullable<string>;
  name: string;
  normalizedName?: string;
  type?: string;
  userId: string;
};

export function createTagsUsageFixtures(prisma: PrismaService) {
  return {
    appearIn: async ({ bookIds, characterId }: { bookIds: string[]; characterId: string }) => {
      await prisma.bookCharacter.createMany({
        data: bookIds.map((bookId) => ({ bookId, characterId })),
      });
    },
    book: ({ deletedAt, title, userId }: SeedBookInput): Promise<Seeded> =>
      prisma.book.create({
        data: { deletedAt, purgeAt: deletedAt, title: title ?? "Untitled", userId },
        select: { id: true },
      }),
    character: ({
      archivedAt,
      deletedAt,
      hideProfileAsSpoiler,
      name,
      userId,
    }: SeedCharacterInput): Promise<Seeded> =>
      prisma.character.create({
        data: {
          archivedAt,
          deletedAt,
          hideProfileAsSpoiler,
          name,
          normalizedName: name.toLowerCase(),
          purgeAt: deletedAt,
          userId,
        },
        select: { id: true },
      }),
    tag: ({
      color,
      createdAt,
      description,
      name,
      normalizedName,
      type,
      userId,
    }: SeedTagInput): Promise<Seeded> =>
      prisma.tag.create({
        data: {
          color,
          createdAt,
          description,
          name,
          normalizedName: normalizedName ?? name.toLowerCase(),
          type,
          userId,
        },
        select: { id: true },
      }),
    tagBooks: async ({ bookIds, tagId }: { bookIds: string[]; tagId: string }) => {
      await prisma.bookTag.createMany({ data: bookIds.map((bookId) => ({ bookId, tagId })) });
    },
    tagCharacters: async ({ characterIds, tagId }: { characterIds: string[]; tagId: string }) => {
      await prisma.characterTag.createMany({
        data: characterIds.map((characterId) => ({ characterId, tagId })),
      });
    },
  };
}
