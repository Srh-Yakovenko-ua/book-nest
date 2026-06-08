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
}
