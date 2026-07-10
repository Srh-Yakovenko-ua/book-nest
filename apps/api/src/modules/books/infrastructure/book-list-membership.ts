import type { Prisma } from "../../../generated/prisma/client.js";

export async function appendBookToList(
  client: Prisma.TransactionClient,
  { bookId, listId }: { bookId: string; listId: string },
): Promise<void> {
  const existing = await client.bookListItem.findUnique({
    select: { listId: true },
    where: { listId_bookId: { bookId, listId } },
  });
  if (existing !== null) {
    return;
  }

  const aggregate = await client.bookListItem.aggregate({
    _max: { position: true },
    where: { listId },
  });
  const nextPosition = (aggregate._max.position ?? 0) + 1;

  await client.bookListItem.create({
    data: { bookId, listId, position: nextPosition },
  });
}
