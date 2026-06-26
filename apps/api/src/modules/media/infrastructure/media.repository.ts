import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { MediaAssetModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

@Injectable()
export class MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.MediaAssetUncheckedCreateInput): Promise<MediaAssetModel> {
    return this.prisma.mediaAsset.create({ data });
  }

  async deleteOwned(userId: string, id: string): Promise<number> {
    const result = await this.prisma.mediaAsset.deleteMany({ where: { id, userId } });
    return result.count;
  }

  findOwnedById(userId: string, id: string): Promise<Nullable<MediaAssetModel>> {
    return this.prisma.mediaAsset.findFirst({ where: { id, userId } });
  }
}
