import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserSocialLinkModel } from "../../../generated/prisma/models.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";

@Injectable()
export class SocialLinkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireUserLock(userId: string, client: Prisma.TransactionClient): Promise<void> {
    await acquireAdvisoryLock({ classId: ADVISORY_LOCK_CLASS.socialLinks, key: userId }, client);
  }

  create(
    userId: string,
    data: Omit<Prisma.UserSocialLinkUncheckedCreateInput, "userId">,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<UserSocialLinkModel> {
    return client.userSocialLink.create({ data: { ...data, userId } });
  }

  async deleteById(id: string, client: Prisma.TransactionClient = this.prisma): Promise<number> {
    const deleted = await client.userSocialLink.deleteMany({ where: { id } });
    return deleted.count;
  }

  findById(id: string): Promise<Nullable<UserSocialLinkModel>> {
    return this.prisma.userSocialLink.findUnique({ where: { id } });
  }

  listByUserId(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<UserSocialLinkModel[]> {
    return client.userSocialLink.findMany({
      orderBy: { createdAt: "asc" },
      where: { userId },
    });
  }

  update(id: string, data: Prisma.UserSocialLinkUpdateInput): Promise<UserSocialLinkModel> {
    return this.prisma.userSocialLink.update({ data, where: { id } });
  }
}
