import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { EmailVerificationTokenModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

type CreateEmailVerificationTokenData = {
  expiresAt: Date;
  tokenHash: string;
  userId: string;
};

@Injectable()
export class EmailVerificationTokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async consume(
    tokenHash: string,
    now: Date,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<{ userId: string }>> {
    const tokenRow = await client.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (tokenRow === null) return null;

    const { count } = await client.emailVerificationToken.deleteMany({
      where: { expiresAt: { gt: now }, tokenHash },
    });
    if (count !== 1) return null;

    return { userId: tokenRow.userId };
  }

  create(
    data: CreateEmailVerificationTokenData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<EmailVerificationTokenModel> {
    return client.emailVerificationToken.create({ data });
  }

  async deleteByUserId(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.emailVerificationToken.deleteMany({ where: { userId } });
  }

  findLatestByUserId(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<EmailVerificationTokenModel>> {
    return client.emailVerificationToken.findFirst({
      orderBy: { createdAt: "desc" },
      where: { userId },
    });
  }
}
