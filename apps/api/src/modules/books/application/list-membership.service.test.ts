import { describe, expect, it, vi } from "vitest";

import type { TransactionRunner } from "../../../core/database/transaction-runner.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { ListsService } from "../../lists/index.js";
import type { ListMembershipRepository } from "../infrastructure/list-membership.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { Prisma as PrismaNamespace } from "../../../generated/prisma/client.js";
import { ListMembershipService } from "./list-membership.service.js";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const LIST_ID = "22222222-2222-4222-8222-222222222222";
const BOOK_ID = "33333333-3333-4333-8333-333333333333";

function foreignKeyError(): PrismaNamespace.PrismaClientKnownRequestError {
  return new PrismaNamespace.PrismaClientKnownRequestError("Foreign key constraint failed", {
    clientVersion: "test",
    code: "P2003",
  });
}

describe("ListMembershipService.addBooks TOCTOU guard", () => {
  it("maps a foreign-key violation from a concurrently-deleted list to NotFoundError", async () => {
    const tx = {} as unknown as Prisma.TransactionClient;
    const listsService = {
      assertOwned: vi.fn().mockResolvedValue(undefined),
    } as unknown as ListsService;
    const touchList = vi.fn().mockResolvedValue(undefined);
    const membershipRepository = {
      acquireListLock: vi.fn().mockResolvedValue(undefined),
      append: vi.fn().mockRejectedValue(foreignKeyError()),
      countItems: vi.fn().mockResolvedValue(0),
      findOwnedBookIds: vi.fn().mockResolvedValue([BOOK_ID]),
      touchList,
    } as unknown as ListMembershipRepository;
    const transactionRunner = {
      run: vi.fn((fn: (client: Prisma.TransactionClient) => Promise<unknown>) => fn(tx)),
    } as unknown as TransactionRunner;

    const service = new ListMembershipService(
      listsService,
      membershipRepository,
      transactionRunner,
    );

    await expect(
      service.addBooks({ input: { bookIds: [BOOK_ID] }, listId: LIST_ID, userId: USER_ID }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(touchList).not.toHaveBeenCalled();
  });
});
