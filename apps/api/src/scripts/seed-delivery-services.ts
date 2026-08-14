import {
  DeliveryServiceSchema,
  normalizeName,
  type Nullable,
  TRACKING_URL_TEMPLATE_PLACEHOLDER,
} from "@app/shared";
import { readFile } from "node:fs/promises";
import { z } from "zod";

import { createLogger } from "../core/logger.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { createSeedClient } from "./seed-client.js";

const logger = createLogger("seed.delivery-services");

type CuratedDeliveryService = {
  countryCode: Nullable<string>;
  name: string;
  providerKey: string;
  trackingUrlTemplate: Nullable<string>;
};

const CURATED_DELIVERY_SERVICES: CuratedDeliveryService[] = [
  {
    countryCode: "UA",
    name: "Нова Пошта",
    providerKey: "nova_poshta",
    trackingUrlTemplate: `https://novaposhta.ua/tracking/index/cargo_number/${TRACKING_URL_TEMPLATE_PLACEHOLDER}/no_redirect/1`,
  },
  {
    countryCode: "UA",
    name: "Укрпошта",
    providerKey: "ukrposhta",
    trackingUrlTemplate: `https://a.ukrposhta.ua/vidslidkuvati-forma-poshuku_UA.html?barcode=${TRACKING_URL_TEMPLATE_PLACEHOLDER}`,
  },
  { countryCode: "UA", name: "Meest", providerKey: "meest", trackingUrlTemplate: null },
  {
    countryCode: "UA",
    name: "Нова Пошта Глобал / Nova Global",
    providerKey: "nova_global",
    trackingUrlTemplate: null,
  },
  { countryCode: "UA", name: "NP Shopping", providerKey: "np_shopping", trackingUrlTemplate: null },
  {
    countryCode: "UA",
    name: "Meest Shopping",
    providerKey: "meest_shopping",
    trackingUrlTemplate: null,
  },
  {
    countryCode: "US",
    name: "AmazonGlobal",
    providerKey: "amazon_global",
    trackingUrlTemplate: null,
  },
  {
    countryCode: null,
    name: "Temu / Marketplace delivery",
    providerKey: "temu",
    trackingUrlTemplate: null,
  },
  {
    countryCode: "CN",
    name: "AliExpress Standard Shipping",
    providerKey: "aliexpress",
    trackingUrlTemplate: null,
  },
  {
    countryCode: "DE",
    name: "DHL",
    providerKey: "dhl",
    trackingUrlTemplate: `https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=${TRACKING_URL_TEMPLATE_PLACEHOLDER}`,
  },
  {
    countryCode: "US",
    name: "UPS",
    providerKey: "ups",
    trackingUrlTemplate: `https://www.ups.com/track?tracknum=${TRACKING_URL_TEMPLATE_PLACEHOLDER}`,
  },
  {
    countryCode: "US",
    name: "FedEx",
    providerKey: "fedex",
    trackingUrlTemplate: `https://www.fedex.com/fedextrack/?trknbr=${TRACKING_URL_TEMPLATE_PLACEHOLDER}`,
  },
  { countryCode: null, name: "Самовивіз", providerKey: "self_pickup", trackingUrlTemplate: null },
  {
    countryCode: null,
    name: "Кур'єр магазину",
    providerKey: "store_courier",
    trackingUrlTemplate: null,
  },
  {
    countryCode: null,
    name: "Міжнародна доставка",
    providerKey: "international",
    trackingUrlTemplate: null,
  },
  {
    countryCode: null,
    name: "Форвардинг / посередник",
    providerKey: "forwarder",
    trackingUrlTemplate: null,
  },
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
          providerKey: entry.providerKey,
          sortOrder: index,
          trackingUrlTemplate: entry.trackingUrlTemplate,
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
          providerKey: entry.providerKey,
          sortOrder: index,
          trackingUrlTemplate: entry.trackingUrlTemplate,
        },
        where: { id: existing.id },
      });
      updated += 1;
    }
  }

  logger.info({ created, updated }, "curated delivery services seeded");
}

async function seedDeliveryServices(): Promise<void> {
  const prisma = createSeedClient();

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
