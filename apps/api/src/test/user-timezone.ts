import type { AuthenticatedUser, AuthTestContext } from "./auth-test-context.js";

import { PrismaService } from "../core/database/prisma.service.js";

export async function registerReaderInTimezone({
  context,
  overrides,
  timezone,
}: {
  context: AuthTestContext;
  overrides?: Parameters<AuthTestContext["registerVerifyAndLogin"]>[0];
  timezone: string;
}): Promise<AuthenticatedUser> {
  const reader = await context.registerVerifyAndLogin(overrides);
  await context.app.get(PrismaService).userProfileSettings.upsert({
    create: { timezone, userId: reader.userId },
    update: { timezone },
    where: { userId: reader.userId },
  });
  return reader;
}
