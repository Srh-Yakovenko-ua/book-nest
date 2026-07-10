import { DeliveryServiceSchema, type Nullable } from "@app/shared";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFile } from "node:fs/promises";
import { z } from "zod";

import { env } from "../config/env.js";
import { createLogger } from "../core/logger.js";
import { normalizeName } from "../core/normalize-name.js";
import { PrismaClient } from "../generated/prisma/client.js";

const logger = createLogger("seed.delivery-services");

const CURATED_DELIVERY_SERVICES: { countryCode: Nullable<string>; name: string }[] = [
  { countryCode: "UA", name: "Нова Пошта" },
  { countryCode: "UA", name: "Укрпошта" },
  { countryCode: "UA", name: "Meest" },
  { countryCode: "UA", name: "Нова Пошта Глобал / Nova Global" },
  { countryCode: "UA", name: "NP Shopping" },
  { countryCode: "UA", name: "Meest Shopping" },
  { countryCode: "US", name: "AmazonGlobal" },
  { countryCode: null, name: "Temu / Marketplace delivery" },
  { countryCode: "CN", name: "AliExpress Standard Shipping" },
  { countryCode: "DE", name: "DHL" },
  { countryCode: "US", name: "UPS" },
  { countryCode: "US", name: "FedEx" },
  { countryCode: null, name: "Самовивіз" },
  { countryCode: null, name: "Кур'єр магазину" },
  { countryCode: null, name: "Міжнародна доставка" },
  { countryCode: null, name: "Форвардинг / посередник" },
];

const DATASET_URL = new URL("./data/delivery-services.dataset.json", import.meta.url);

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

const DatasetSchema = z.array(
  z.object({
    countryCode: z.string().regex(COUNTRY_CODE_PATTERN).nullable(),
    name: DeliveryServiceSchema,
  }),
);

type PrismaClientInstance = InstanceType<typeof PrismaClient>;

async function loadDataset(): Promise<z.infer<typeof DatasetSchema>> {
  const raw = await readFile(DATASET_URL, "utf8");
  return DatasetSchema.parse(JSON.parse(raw));
}

async function seedBulk(prisma: PrismaClientInstance): Promise<void> {
  const dataset = await loadDataset();

  const existingGlobals = await prisma.deliveryService.findMany({
    select: { normalizedName: true },
    where: { userId: null },
  });
  const existingNormalizedNames = new Set(existingGlobals.map((row) => row.normalizedName));

  const seenNormalizedNames = new Set<string>();
  const toInsert: { countryCode: Nullable<string>; name: string; normalizedName: string }[] = [];
  for (const item of dataset) {
    const normalizedName = normalizeName(item.name);
    if (existingNormalizedNames.has(normalizedName) || seenNormalizedNames.has(normalizedName)) {
      continue;
    }
    seenNormalizedNames.add(normalizedName);
    toInsert.push({ countryCode: item.countryCode, name: item.name, normalizedName });
  }

  const created =
    toInsert.length === 0
      ? 0
      : (
          await prisma.deliveryService.createMany({
            data: toInsert.map((entry) => ({
              countryCode: entry.countryCode,
              isDefault: false,
              name: entry.name,
              normalizedName: entry.normalizedName,
              sortOrder: 0,
              userId: null,
            })),
          })
        ).count;

  logger.info(
    { created, skipped: dataset.length - toInsert.length },
    "bulk delivery services seeded",
  );
}

async function seedCurated(prisma: PrismaClientInstance): Promise<void> {
  let created = 0;
  let updated = 0;

  for (const [index, entry] of CURATED_DELIVERY_SERVICES.entries()) {
    const normalizedName = normalizeName(entry.name);
    const existing = await prisma.deliveryService.findFirst({
      select: { id: true },
      where: { normalizedName, userId: null },
    });

    if (existing === null) {
      await prisma.deliveryService.create({
        data: {
          countryCode: entry.countryCode,
          isDefault: true,
          name: entry.name,
          normalizedName,
          sortOrder: index,
          userId: null,
        },
      });
      created += 1;
    } else {
      await prisma.deliveryService.update({
        data: {
          countryCode: entry.countryCode,
          isDefault: true,
          name: entry.name,
          sortOrder: index,
        },
        where: { id: existing.id },
      });
      updated += 1;
    }
  }

  logger.info({ created, updated }, "curated delivery services seeded");
}

async function seedDeliveryServices(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.databaseUrl }),
  });

  try {
    await seedCurated(prisma);
    await seedBulk(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

seedDeliveryServices()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    logger.error({ error: String(error) }, "delivery service seed failed");
    process.exit(1);
  });
