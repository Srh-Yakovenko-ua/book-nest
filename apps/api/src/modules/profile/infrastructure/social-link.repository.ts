import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserSocialLinkModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

@Injectable()
export class SocialLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  countByUserId(userId: string, client: Prisma.TransactionClient = this.prisma): Promise<number> {
    return client.userSocialLink.count({ where: { userId } });
  }

  create(
    userId: string,
    data: Omit<Prisma.UserSocialLinkUncheckedCreateInput, "userId">,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<UserSocialLinkModel> {
    return client.userSocialLink.create({ data: { ...data, userId } });
  }

  deleteById(id: string): Promise<UserSocialLinkModel> {
    return this.prisma.userSocialLink.delete({ where: { id } });
  }

  findById(id: string): Promise<Nullable<UserSocialLinkModel>> {
    return this.prisma.userSocialLink.findUnique({ where: { id } });
  }

  listByUserId(userId: string): Promise<UserSocialLinkModel[]> {
    return this.prisma.userSocialLink.findMany({
      orderBy: { createdAt: "asc" },
      where: { userId },
    });
  }

  update(id: string, data: Prisma.UserSocialLinkUpdateInput): Promise<UserSocialLinkModel> {
    return this.prisma.userSocialLink.update({ data, where: { id } });
  }
}
