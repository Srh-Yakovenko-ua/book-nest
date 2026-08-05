import { PrismaPg } from "@prisma/adapter-pg";

import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

export function createSeedClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.databaseUrl }),
  });
}
