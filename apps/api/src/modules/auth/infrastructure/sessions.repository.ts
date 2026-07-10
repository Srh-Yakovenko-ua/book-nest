import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { SessionModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

type CreateSessionData = {
  expiresAt: Date;
  refreshHash: string;
  userId: string;
};

@Injectable()
export class SessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: CreateSessionData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<SessionModel> {
    return client.session.create({ data });
  }

  async deleteAllByUserId(
    userId: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.session.deleteMany({ where: { userId } });
  }

  async deleteById(id: string, client: Prisma.TransactionClient = this.prisma): Promise<void> {
    await client.session.deleteMany({ where: { id } });
  }

  async deleteByRefreshHash(
    refreshHash: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await client.session.deleteMany({ where: { refreshHash } });
  }

  findByRefreshHash(
    refreshHash: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<SessionModel>> {
    return client.session.findUnique({ where: { refreshHash } });
  }

  async rotate(
    id: string,
    rotatedAt: Date,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<number> {
    const { count } = await client.session.updateMany({
      data: { rotatedAt },
      where: { id, rotatedAt: null },
    });

    return count;
  }
}
