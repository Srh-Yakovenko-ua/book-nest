import type { LoanContactCounts, LoanContactStatus, Nullable } from "@app/shared";

import { Injectable } from "@nestjs/common";

import type { LoanContactModel } from "../../../generated/prisma/models.js";

import { escapeLikePattern } from "../../../core/database/like-pattern.js";
import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";
import { Prisma } from "../../../generated/prisma/client.js";

const ownedLoanContactCardArgs = (userId: string) =>
  ({
    include: {
      _count: { select: { loans: { where: { book: SOFT_DELETE_SCOPE.active, userId } } } },
    },
  }) satisfies Prisma.LoanContactDefaultArgs;

export type CountLoanContactsInput = {
  search: string | undefined;
  userId: string;
};

export type CreateLoanContactData = {
  contact: Nullable<string>;
  name: string;
  normalizedName: string;
  userId: string;
};

export type ListLoanContactsInput = CountLoanContactsInput & {
  skip: number;
  status: LoanContactStatus;
  take: number;
};

export type LoanContactCard = Prisma.LoanContactGetPayload<
  ReturnType<typeof ownedLoanContactCardArgs>
>;

export type LoanContactRename = {
  name: string;
  normalizedName: string;
};

export type SetLoanContactArchivedData = {
  archivedAt: Nullable<Date>;
  id: string;
  userId: string;
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

  async countOwned({ search, userId }: CountLoanContactsInput): Promise<LoanContactCounts> {
    const [all, archived] = await Promise.all([
      this.prisma.loanContact.count({
        where: buildLoanContactsWhere({ search, status: "all", userId }),
      }),
      this.prisma.loanContact.count({
        where: buildLoanContactsWhere({ search, status: "archived", userId }),
      }),
    ]);

    return { active: all - archived, all, archived };
  }

  create(
    { contact, name, normalizedName, userId }: CreateLoanContactData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoanContactCard> {
    return client.loanContact.create({
      data: { contact, name, normalizedName, userId },
      ...ownedLoanContactCardArgs(userId),
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

  findOwnedCardById(
    { id, userId }: { id: string; userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<LoanContactCard>> {
    return client.loanContact.findFirst({
      where: { id, userId },
      ...ownedLoanContactCardArgs(userId),
    });
  }

  findOwnedCardByNormalizedName({
    normalizedName,
    userId,
  }: {
    normalizedName: string;
    userId: string;
  }): Promise<Nullable<LoanContactCard>> {
    return this.prisma.loanContact.findUnique({
      where: { userId_normalizedName: { normalizedName, userId } },
      ...ownedLoanContactCardArgs(userId),
    });
  }

  listOwned({
    search,
    skip,
    status,
    take,
    userId,
  }: ListLoanContactsInput): Promise<LoanContactCard[]> {
    return this.prisma.loanContact.findMany({
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip,
      take,
      where: buildLoanContactsWhere({ search, status, userId }),
      ...ownedLoanContactCardArgs(userId),
    });
  }

  setArchivedAt(
    { archivedAt, id, userId }: SetLoanContactArchivedData,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoanContactCard> {
    return client.loanContact.update({
      data: { archivedAt },
      where: { id, userId },
      ...ownedLoanContactCardArgs(userId),
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

    return client.loanContact.update({
      data,
      where: { id, userId },
      ...ownedLoanContactCardArgs(userId),
    });
  }
}

function buildLoanContactsWhere({
  search,
  status,
  userId,
}: CountLoanContactsInput & { status: LoanContactStatus }): Prisma.LoanContactWhereInput {
  const where: Prisma.LoanContactWhereInput = { userId };
  if (status === "active") {
    where.archivedAt = null;
  }
  if (status === "archived") {
    where.archivedAt = { not: null };
  }
  if (search !== undefined) {
    where.name = { contains: escapeLikePattern(search), mode: "insensitive" };
  }

  return where;
}
