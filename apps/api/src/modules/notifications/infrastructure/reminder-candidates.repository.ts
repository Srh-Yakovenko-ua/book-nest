import type { LoanStatus, Nullable } from "@app/shared";

import { SHIPMENT_ACTIVE_STATUSES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import { SOFT_DELETE_SCOPE } from "../../../core/database/soft-delete.js";

const ACTIVE_LOAN_STATUS = "active" as const satisfies LoanStatus;

const REMINDABLE_LOAN_FILTER = {
  book: SOFT_DELETE_SCOPE.active,
  expectedReturnDate: { not: null },
  remindToReturn: true,
  returnedAt: null,
  status: ACTIVE_LOAN_STATUS,
} as const satisfies Prisma.BookLoanWhereInput;

const REMINDABLE_SHIPMENT_ITEM_FILTER = {
  book: SOFT_DELETE_SCOPE.active,
  cancelledAt: null,
  receivedAt: null,
} as const satisfies Prisma.BookOrderItemWhereInput;

const REMINDABLE_DELIVERY_FILTER = {
  expectedDeliveryDate: { not: null },
  items: { some: REMINDABLE_SHIPMENT_ITEM_FILTER },
  status: { in: [...SHIPMENT_ACTIVE_STATUSES] },
} as const satisfies Prisma.ShipmentWhereInput;

const CANDIDATE_USER_FILTER = {
  OR: [
    { bookLoans: { some: REMINDABLE_LOAN_FILTER } },
    { bookOrders: { some: { shipments: { some: REMINDABLE_DELIVERY_FILTER } } } },
  ],
} as const satisfies Prisma.UserWhereInput;

function deliveryCandidateArgs({
  itemsPerShipment,
  userId,
}: {
  itemsPerShipment: number;
  userId: string;
}) {
  return {
    select: {
      expectedDeliveryDate: true,
      id: true,
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { book: { select: { id: true, title: true } } },
        take: itemsPerShipment,
        where: {
          ...REMINDABLE_SHIPMENT_ITEM_FILTER,
          book: { ...SOFT_DELETE_SCOPE.active, userId },
          order: { userId },
        },
      },
      order: { select: { storeName: true } },
    },
  } satisfies Prisma.ShipmentDefaultArgs;
}

const loanCandidateArgs = {
  select: {
    book: { select: { id: true, title: true } },
    expectedReturnDate: true,
    id: true,
    loanDate: true,
    personName: true,
  },
} satisfies Prisma.BookLoanDefaultArgs;

const reminderRecipientArgs = {
  select: {
    emailVerifiedAt: true,
    id: true,
    settings: {
      select: {
        borrowedBookReminders: true,
        deliveryReminders: true,
        loanReminderLeadDays: true,
      },
    },
  },
} satisfies Prisma.UserDefaultArgs;

export type DeliveryCandidateRow = Prisma.ShipmentGetPayload<
  ReturnType<typeof deliveryCandidateArgs>
>;

export type LoanCandidateRow = Prisma.BookLoanGetPayload<typeof loanCandidateArgs>;

export type ReminderRecipientRow = Prisma.UserGetPayload<typeof reminderRecipientArgs>;

type CandidateQueryInput = {
  afterId: Nullable<string>;
  dueFrom: Date;
  dueTo: Date;
  limit: number;
  userId: string;
};

type DeliveryCandidateQueryInput = CandidateQueryInput & {
  itemsPerShipment: number;
};

type RecipientQueryInput = {
  afterUserId: Nullable<string>;
  deliveryDueFrom: Date;
  deliveryDueTo: Date;
  includeMissingSettings: boolean;
  limit: number;
  loanDueFrom: Date;
  loanDueTo: Date;
  timezone: string;
};

@Injectable()
export class ReminderCandidatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findCandidateTimezones(
    { fallbackTimezone }: { fallbackTimezone: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    const [storedTimezones, userWithoutSettings] = await Promise.all([
      client.userProfileSettings.findMany({
        distinct: ["timezone"],
        select: { timezone: true },
        where: { user: CANDIDATE_USER_FILTER },
      }),
      client.user.findFirst({
        select: { id: true },
        where: { ...CANDIDATE_USER_FILTER, settings: { is: null } },
      }),
    ]);

    const effectiveTimezones = storedTimezones.map((row) => row.timezone);
    if (userWithoutSettings !== null) {
      effectiveTimezones.push(fallbackTimezone);
    }
    return [...new Set(effectiveTimezones)];
  }

  findDeliveryCandidates(
    { afterId, dueFrom, dueTo, itemsPerShipment, limit, userId }: DeliveryCandidateQueryInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<DeliveryCandidateRow[]> {
    return client.shipment.findMany({
      orderBy: { id: "asc" },
      select: deliveryCandidateArgs({ itemsPerShipment, userId }).select,
      take: limit,
      where: {
        ...REMINDABLE_DELIVERY_FILTER,
        ...afterIdFilter(afterId),
        expectedDeliveryDate: { gte: dueFrom, lte: dueTo },
        order: { userId },
      },
    });
  }

  findLoanCandidates(
    { afterId, dueFrom, dueTo, limit, userId }: CandidateQueryInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<LoanCandidateRow[]> {
    return client.bookLoan.findMany({
      orderBy: { id: "asc" },
      select: loanCandidateArgs.select,
      take: limit,
      where: {
        ...REMINDABLE_LOAN_FILTER,
        ...afterIdFilter(afterId),
        expectedReturnDate: { gte: dueFrom, lte: dueTo },
        userId,
      },
    });
  }

  findReminderRecipientById(
    { userId }: { userId: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<Nullable<ReminderRecipientRow>> {
    return client.user.findUnique({
      select: reminderRecipientArgs.select,
      where: { id: userId },
    });
  }

  findReminderRecipients(
    {
      afterUserId,
      deliveryDueFrom,
      deliveryDueTo,
      includeMissingSettings,
      limit,
      loanDueFrom,
      loanDueTo,
      timezone,
    }: RecipientQueryInput,
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<ReminderRecipientRow[]> {
    return client.user.findMany({
      orderBy: { id: "asc" },
      select: reminderRecipientArgs.select,
      take: limit,
      where: {
        AND: [
          buildTimezoneUserFilter({ includeMissingSettings, timezone }),
          {
            OR: [
              {
                bookLoans: {
                  some: {
                    ...REMINDABLE_LOAN_FILTER,
                    expectedReturnDate: { gte: loanDueFrom, lte: loanDueTo },
                  },
                },
              },
              {
                bookOrders: {
                  some: {
                    shipments: {
                      some: {
                        ...REMINDABLE_DELIVERY_FILTER,
                        expectedDeliveryDate: { gte: deliveryDueFrom, lte: deliveryDueTo },
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
        ...(afterUserId === null ? {} : { id: { gt: afterUserId } }),
      },
    });
  }

  async findUserIdsByTimezone(
    { timezone }: { timezone: string },
    client: Prisma.TransactionClient = this.prisma,
  ): Promise<string[]> {
    const users = await client.user.findMany({
      select: { id: true },
      where: { ...CANDIDATE_USER_FILTER, settings: { timezone } },
    });
    return users.map((user) => user.id);
  }
}

function afterIdFilter(afterId: Nullable<string>): { id?: { gt: string } } {
  return afterId === null ? {} : { id: { gt: afterId } };
}

function buildTimezoneUserFilter({
  includeMissingSettings,
  timezone,
}: {
  includeMissingSettings: boolean;
  timezone: string;
}): Prisma.UserWhereInput {
  const matches: Prisma.UserWhereInput[] = [{ settings: { timezone } }];
  if (includeMissingSettings) {
    matches.push({ settings: { is: null } });
  }
  return { OR: matches };
}
