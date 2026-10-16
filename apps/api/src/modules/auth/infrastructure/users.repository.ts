import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { UserModel } from "../../../generated/prisma/models.js";

import { PrismaService } from "../../../core/database/prisma.service.js";

type CreateUserData = {
  dateOfBirth?: Date;
  email: string;
  name: string;
  nickname?: string;
  passwordHash: string;
};

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateUserData, client: Prisma.TransactionClient = this.prisma): Promise<UserModel> {
    return client.user.create({ data });
  }

  async deleteById(id: string, client: Prisma.TransactionClient = this.prisma): Promise<void> {
    await client.user.deleteMany({ where: { id } });
  }

  findByEmail(
    email: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<UserModel>> {
    return client.user.findUnique({ where: { email } });
  }

  findById(
    id: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<UserModel>> {
    return client.user.findUnique({ where: { id } });
  }

  findByNickname(
    nickname: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<UserModel>> {
    return client.user.findUnique({ where: { nickname } });
  }

  markEmailVerified(
    userId: string,
    verifiedAt: Date,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<UserModel> {
    return client.user.update({ data: { emailVerifiedAt: verifiedAt }, where: { id: userId } });
  }

  updatePassword(
    userId: string,
    passwordHash: string,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<UserModel> {
    return client.user.update({
      data: { passwordChangedAt: new Date(), passwordHash },
      where: { id: userId },
    });
  }
}
