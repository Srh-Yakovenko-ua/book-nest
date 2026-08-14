import type { Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { LoanContactModel } from "../../../generated/prisma/models.js";

import { escapeLikeMetacharacters } from "../../../core/database/like-pattern.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";

const loanContactCardArgs = {
  include: { _count: { select: { loans: { where: { book: SOFT_DELETE_SCOPE.active } } } } },
} satisfies Prisma.LoanContactDefaultArgs;

export type CreateLoanContactData = {
  contact: Nullable<string>;
  name: string;
  normalizedName: string;
  userId: string;
};

export type ListLoanContactsInput = {
  includeArchived: boolean;
  limit: number;
  search: string | undefined;
  userId: string;
};

export type LoanContactCard = Prisma.LoanContactGetPayload<typeof loanContactCardArgs>;

export type LoanContactRename = {
  name: string;
  normalizedName: string;
};

export type UpdateLoanContactData = {
  contact: Nullable<string> | undefined;
  id: string;
  rename: LoanContactRename | undefined;
  userId: string;
};

@Injectable()
export class LoanContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    { contact, name, normalizedName, userId }: CreateLoanContactData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoanContactCard> {
    return client.loanContact.create({
      data: { contact, name, normalizedName, userId },
      ...loanContactCardArgs,
    });
  }

  async ensureByNormalizedName(
    { contact, name, normalizedName, userId }: CreateLoanContactData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoanContactModel> {
    const existing = await this.findByNormalizedName({ normalizedName, userId }, client);
    if (existing !== null) {
      return existing;
    }

    await client.loanContact.createMany({
      data: [{ contact, name, normalizedName, userId }],
      skipDuplicates: true,
    });
    return client.loanContact.findUniqueOrThrow({
      where: { userId_normalizedName: { normalizedName, userId } },
    });
  }

  findByNormalizedName(
    { normalizedName, userId }: { normalizedName: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<LoanContactModel>> {
    return client.loanContact.findUnique({
      where: { userId_normalizedName: { normalizedName, userId } },
    });
  }

  findOwnedById(
    { id, userId }: { id: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<LoanContactModel>> {
    return client.loanContact.findFirst({ where: { id, userId } });
  }

  listOwned({
    includeArchived,
    limit,
    search,
    userId,
  }: ListLoanContactsInput): Promise<LoanContactCard[]> {
    const where: Prisma.LoanContactWhereInput = { userId };
    if (!includeArchived) {
      where.archivedAt = null;
    }
    if (search !== undefined) {
      where.name = { contains: escapeLikeMetacharacters(search), mode: "insensitive" };
    }

    return this.prisma.loanContact.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: limit,
      where,
      ...loanContactCardArgs,
    });
  }

  updateOwned(
    { contact, id, rename, userId }: UpdateLoanContactData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoanContactCard> {
    const data: Prisma.LoanContactUpdateInput = {};
    if (rename !== undefined) {
      data.name = rename.name;
      data.normalizedName = rename.normalizedName;
    }
    if (contact !== undefined) {
      data.contact = contact;
    }

    return client.loanContact.update({ data, where: { id, userId }, ...loanContactCardArgs });
  }
}
