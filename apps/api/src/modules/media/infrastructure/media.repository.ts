import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { MediaAssetModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

export type MediaOwnerRef = {
  id: string;
  userId: string;
};

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countReferences(id: string): Promise<number> {
    const [bookCovers, characterAvatars, bookCharacterPortraits] = await Promise.all([
      this.prisma.book.count({ where: { coverMediaId: id } }),
      this.prisma.character.count({ where: { avatarMediaId: id } }),
      this.prisma.bookCharacter.count({ where: { portraitMediaId: id } }),
    ]);
    return bookCovers + characterAvatars + bookCharacterPortraits;
  }

  create(data: Prisma.MediaAssetUncheckedCreateInput): Promise<MediaAssetModel> {
    return this.prisma.mediaAsset.create({ data });
  }

  async deleteOwned({ id, userId }: MediaOwnerRef): Promise<number> {
    const result = await this.prisma.mediaAsset.deleteMany({ where: { id, userId } });
    return result.count;
  }

  findIdsWithoutThumbnail(): Promise<{ id: string; userId: string }[]> {
    return this.prisma.mediaAsset.findMany({
      select: { id: true, userId: true },
      where: { thumbGeneratedAt: null },
    });
  }

  findOwnedById({ id, userId }: MediaOwnerRef): Promise<Nullable<MediaAssetModel>> {
    return this.prisma.mediaAsset.findFirst({ where: { id, userId } });
  }

  async markThumbGenerated(id: string): Promise<boolean> {
    const result = await this.prisma.mediaAsset.updateMany({
      data: { thumbGeneratedAt: new Date() },
      where: { id },
    });
    return result.count > 0;
  }
}
