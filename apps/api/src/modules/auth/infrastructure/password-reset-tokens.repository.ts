import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { PasswordResetTokenModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

type CreatePasswordResetTokenData = {
  expiresAt: Date;
  tokenHash: string;
  userId: string;
};

@Injectable()
export class PasswordResetTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async consume(
    tokenHash: string,
    now: Date,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<{ userId: string }>> {
    const tokenRow = await client.passwordResetToken.findUnique({ where: { tokenHash } });
    if (tokenRow === null) return null;

    const { count } = await client.passwordResetToken.deleteMany({
      where: { expiresAt: { gt: now }, tokenHash },
    });
    if (count !== 1) return null;

    return { userId: tokenRow.userId };
  }

  create(
    data: CreatePasswordResetTokenData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<PasswordResetTokenModel> {
    return client.passwordResetToken.create({ data });
  }

  async deleteByUserId(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.passwordResetToken.deleteMany({ where: { userId } });
  }

  findLatestByUserId(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<PasswordResetTokenModel>> {
    return client.passwordResetToken.findFirst({
      orderBy: { createdAt: "desc" },
      where: { userId },
    });
  }
}
