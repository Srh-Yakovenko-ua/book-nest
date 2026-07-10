import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

const withSocialLinks = {
  socialLinks: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.UserInclude;

export type ProfileWithSocialLinks = Prisma.UserGetPayload<{ include: typeof withSocialLinks }>;

@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<Nullable<ProfileWithSocialLinks>> {
    return this.prisma.user.findUnique({
      include: withSocialLinks,
      where: { id: userId },
    });
  }

  update(userId: string, data: Prisma.UserUpdateInput): Promise<ProfileWithSocialLinks> {
    return this.prisma.user.update({
      data,
      include: withSocialLinks,
      where: { id: userId },
    });
  }
}
