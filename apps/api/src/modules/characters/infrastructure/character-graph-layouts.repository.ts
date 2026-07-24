import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { CharacterGraphLayoutModel } from "../../../generated/prisma/models.js";

import { acquireAdvisoryLock, ADVISORY_LOCK_CLASS } from "../../../core/database/advisory-lock.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

const LOCK_SENTINEL = "~";

export type CharacterGraphLayoutKey = {
  contextBookId: Nullable<string>;
  mode: string;
  scopeId: Nullable<string>;
  scopeType: string;
  userId: string;
};

export type SaveLayoutData = CharacterGraphLayoutKey & {
  layoutVersion: string;
  positions: Prisma.InputJsonValue;
  viewport: Nullable<Prisma.InputJsonValue>;
};

@Injectable()
export class CharacterGraphLayoutsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async acquireLayoutLock(
    key: CharacterGraphLayoutKey,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const lockKey = [
      "cgl",
      key.userId,
      key.scopeType,
      key.scopeId ?? LOCK_SENTINEL,
      key.mode,
      key.contextBookId ?? LOCK_SENTINEL,
    ].join(":");
    await acquireAdvisoryLock(
      { classId: ADVISORY_LOCK_CLASS.characterGraphLayouts, key: lockKey },
      client,
    );
  }

  createLayout(
    data: SaveLayoutData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterGraphLayoutModel> {
    return client.characterGraphLayout.create({
      data: {
        contextBookId: data.contextBookId,
        layoutVersion: data.layoutVersion,
        mode: data.mode,
        positions: data.positions,
        scopeId: data.scopeId,
        scopeType: data.scopeType,
        userId: data.userId,
        viewport: toViewportInput(data.viewport),
      },
    });
  }

  async deleteByKey(key: CharacterGraphLayoutKey): Promise<number> {
    const result = await this.prisma.characterGraphLayout.deleteMany({ where: toWhere(key) });
    return result.count;
  }

  findByKey(
    key: CharacterGraphLayoutKey,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<CharacterGraphLayoutModel>> {
    return client.characterGraphLayout.findFirst({ where: toWhere(key) });
  }

  updateLayout(
    { data, id }: { data: SaveLayoutData; id: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<CharacterGraphLayoutModel> {
    return client.characterGraphLayout.update({
      data: {
        layoutVersion: data.layoutVersion,
        positions: data.positions,
        viewport: toViewportInput(data.viewport),
      },
      where: { id },
    });
  }
}

function toViewportInput(viewport: Nullable<Prisma.InputJsonValue>) {
  return viewport === null ? Prisma.DbNull : viewport;
}

function toWhere(key: CharacterGraphLayoutKey): Prisma.CharacterGraphLayoutWhereInput {
  return {
    contextBookId: key.contextBookId,
    mode: key.mode,
    scopeId: key.scopeId,
    scopeType: key.scopeType,
    userId: key.userId,
  };
}
