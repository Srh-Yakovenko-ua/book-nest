import { createLogger } from "../core/logger.js";
import { readSpeciesCatalog } from "../modules/species/infrastructure/species-catalog-file.js";
import { createSeedClient } from "./seed-client.js";
import { seedSystemSpecies } from "./seed-system-species.js";

const logger = createLogger("seed.species");

async function seedSpecies(): Promise<void> {
  const prisma = createSeedClient();

  try {
    const result = await seedSystemSpecies({ catalog: await readSpeciesCatalog(), prisma });
    logger.info(result, "species seed completed");
  } finally {
    await prisma.$disconnect();
  }
}

seedSpecies()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    logger.error({ error: String(error) }, "species seed failed");
    process.exit(1);
  });
