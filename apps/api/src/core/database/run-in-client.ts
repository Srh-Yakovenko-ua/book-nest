import type { Prisma } from "../../generated/prisma/client.js";

import { type PrismaService } from "./prisma.service.js";

export function runInClient<Result>(
  {
    client,
    prisma,
  }: {
    client: Prisma.TransactionClient | undefined;
    prisma: PrismaService;
  },
  run: (client: Prisma.TransactionClient) => Promise<Result>,
): Promise<Result> {
  if (client === undefined) {
    return prisma.$transaction((tx) => run(tx));
  }
  return run(client);
}
