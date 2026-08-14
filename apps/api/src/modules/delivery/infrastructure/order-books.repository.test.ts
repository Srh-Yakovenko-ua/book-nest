import type { Nullable, OwnershipStatus } from "@app/shared";

import { OwnershipStatusSchema } from "@app/shared";
import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../../../core/database/prisma.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";

import { resolveWishlistAddedAtChange } from "../../books/index.js";
import { OrderBooksRepository } from "./order-books.repository.js";

const USER = "user-1";
const BOOK = "book-1";
const NOW = new Date("2026-08-13T10:00:00.000Z");

const OWNERSHIP_STATUSES = OwnershipStatusSchema.options;

type CapturedUpdate = {
  data: { wishlistAddedAt?: Nullable<Date> };
  where: { ownershipStatus?: OwnershipStatus | { not: OwnershipStatus } };
};

type WishlistOutcome = "untouched" | { wishlistAddedAt: Nullable<Date> };

async function captureOwnershipWrites(next: OwnershipStatus): Promise<CapturedUpdate[]> {
  const captured: CapturedUpdate[] = [];
  const client = {
    book: {
      updateMany: vi.fn((args: CapturedUpdate) => {
        captured.push(args);
        return Promise.resolve({ count: 1 });
      }),
    },
  } as unknown as Prisma.TransactionClient;

  await new OrderBooksRepository({} as PrismaService).applyOwnership(
    { bookIds: [BOOK], now: NOW, ownershipStatus: next, userId: USER },
    client,
  );

  return captured;
}

function matchesCurrentStatus({
  current,
  where,
}: {
  current: OwnershipStatus;
  where: CapturedUpdate["where"];
}): boolean {
  const expected = where.ownershipStatus;
  if (expected === undefined) {
    return true;
  }
  return typeof expected === "string" ? current === expected : current !== expected.not;
}

function replayOnBook({
  captured,
  current,
}: {
  captured: CapturedUpdate[];
  current: OwnershipStatus;
}): WishlistOutcome {
  let outcome: WishlistOutcome = "untouched";
  for (const update of captured) {
    if (!matchesCurrentStatus({ current, where: update.where })) {
      continue;
    }
    if (update.data.wishlistAddedAt !== undefined) {
      outcome = { wishlistAddedAt: update.data.wishlistAddedAt };
    }
  }
  return outcome;
}

function ruleOutcome({
  current,
  next,
}: {
  current: OwnershipStatus;
  next: OwnershipStatus;
}): WishlistOutcome {
  return resolveWishlistAddedAtChange({ current, next, now: NOW }) ?? "untouched";
}

describe("OrderBooksRepository.applyOwnership", () => {
  it.each(OWNERSHIP_STATUSES)(
    "stamps the wishlist date exactly as the books rule does when a book becomes %s",
    async (next) => {
      const captured = await captureOwnershipWrites(next);

      for (const current of OWNERSHIP_STATUSES) {
        expect({ current, next, outcome: replayOnBook({ captured, current }) }).toEqual({
          current,
          next,
          outcome: ruleOutcome({ current, next }),
        });
      }
    },
  );

  it("writes the new ownership status for every named book", async () => {
    const captured = await captureOwnershipWrites("owned");

    expect(captured.at(-1)).toEqual({
      data: { ownershipStatus: "owned" },
      where: { deletedAt: null, id: { in: [BOOK] }, userId: USER },
    });
  });

  it("touches nothing when no book was named", async () => {
    const updateMany = vi.fn();
    const client = { book: { updateMany } } as unknown as Prisma.TransactionClient;

    const updated = await new OrderBooksRepository({} as PrismaService).applyOwnership(
      { bookIds: [], now: NOW, ownershipStatus: "owned", userId: USER },
      client,
    );

    expect(updated).toBe(0);
    expect(updateMany).not.toHaveBeenCalled();
  });
});
