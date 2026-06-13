import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { env } from "../config/env.js";
import { createLogger } from "../core/logger.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { fetchCommonsImageLicenses } from "./fetch-commons-image-license.js";
import { mapWikidataPublisherRow, type PublisherSeedInput } from "./map-wikidata-publisher-row.js";

const logger = createLogger("seed.publishers");

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = env.wikidataContact;
const PUBLISHER_TYPES = ["Q1320047", "Q1156831", "Q2085381"];
const UKRAINE_COUNTRY = "Q212";
const GLOBAL_MIN_SITELINKS = 5;
const UKRAINIAN_MIN_SITELINKS = 1;
const ENRICH_BATCH_SIZE = 150;
const UPSERT_BATCH_SIZE = 50;
const TARGET_PUBLISHER_CAP = 1500;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 2_000;

const ENTITY_URI_PREFIX = "http://www.wikidata.org/entity/";

const SparqlValueSchema = z.object({ value: z.string() });

const CoreBindingSchema = z.object({
  publisher: SparqlValueSchema,
  sitelinks: SparqlValueSchema,
});

const CoreResponseSchema = z.object({
  results: z.object({ bindings: z.array(CoreBindingSchema) }),
});

const EnrichBindingSchema = z.object({
  inception: SparqlValueSchema.optional(),
  iso: SparqlValueSchema.optional(),
  logo: SparqlValueSchema.optional(),
  publisher: SparqlValueSchema,
  publisherLabel: SparqlValueSchema.optional(),
  website: SparqlValueSchema.optional(),
});

const EnrichResponseSchema = z.object({
  results: z.object({ bindings: z.array(EnrichBindingSchema) }),
});

type CoreCandidate = {
  sitelinks: number;
  wikidataId: string;
};

type EnrichedFields = {
  countryCode: null | string;
  inception: null | string;
  logo: null | string;
  publisherLabel: null | string;
  website: null | string;
};

function buildEnrichQuery(entityIds: string[]): string {
  const values = entityIds.map((id) => `wd:${id}`).join(" ");
  return `SELECT ?publisher ?publisherLabel ?iso ?inception ?website ?logo WHERE {
  VALUES ?publisher { ${values} }
  OPTIONAL { ?publisher wdt:P17 ?country . ?country wdt:P297 ?iso . }
  OPTIONAL { ?publisher wdt:P571 ?inception . }
  OPTIONAL { ?publisher wdt:P856 ?website . }
  OPTIONAL { ?publisher wdt:P154 ?logo . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "uk,en,ru". }
} LIMIT 10000`;
}

function buildGlobalCoreQuery(): string {
  const typeValues = PUBLISHER_TYPES.map((id) => `wd:${id}`).join(" ");
  return `SELECT DISTINCT ?publisher ?sitelinks WHERE {
  VALUES ?type { ${typeValues} }
  ?publisher wdt:P31 ?type .
  ?publisher wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= ${String(GLOBAL_MIN_SITELINKS)})
} LIMIT 5000`;
}

function buildSeedInputs(
  candidates: Map<string, CoreCandidate>,
  enriched: Map<string, EnrichedFields>,
): PublisherSeedInput[] {
  const ranked = [...candidates.values()].sort((left, right) => right.sitelinks - left.sitelinks);
  const seen = new Set<string>();
  const inputs: PublisherSeedInput[] = [];

  for (const candidate of ranked) {
    if (inputs.length >= TARGET_PUBLISHER_CAP) {
      break;
    }
    const fields = enriched.get(candidate.wikidataId);
    if (fields === undefined) {
      continue;
    }

    const seedInput = mapWikidataPublisherRow({
      countryCode: fields.countryCode,
      inception: fields.inception,
      logo: fields.logo,
      publisherLabel: fields.publisherLabel,
      website: fields.website,
      wikidataId: candidate.wikidataId,
    });

    if (seedInput === null || seen.has(seedInput.normalizedName)) {
      continue;
    }
    seen.add(seedInput.normalizedName);
    inputs.push(seedInput);
  }

  return inputs;
}

function buildUkrainianCoreQuery(): string {
  const typeValues = PUBLISHER_TYPES.map((id) => `wd:${id}`).join(" ");
  return `SELECT DISTINCT ?publisher ?sitelinks WHERE {
  VALUES ?type { ${typeValues} }
  ?publisher wdt:P31 ?type .
  ?publisher wdt:P17 wd:${UKRAINE_COUNTRY} .
  ?publisher wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= ${String(UKRAINIAN_MIN_SITELINKS)})
} LIMIT 5000`;
}

function chunk<Item>(items: Item[], size: number): Item[][] {
  const batches: Item[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function collectCore(
  candidates: Map<string, CoreCandidate>,
  bindings: z.infer<typeof CoreResponseSchema>["results"]["bindings"],
): void {
  for (const binding of bindings) {
    const wikidataId = entityIdFromUri(binding.publisher.value);
    const sitelinks = Number.parseInt(binding.sitelinks.value, 10);

    const existing = candidates.get(wikidataId);
    if (existing === undefined) {
      candidates.set(wikidataId, { sitelinks, wikidataId });
      continue;
    }
    if (sitelinks > existing.sitelinks) {
      existing.sitelinks = sitelinks;
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function enrichLogoLicenses(inputs: PublisherSeedInput[]): Promise<void> {
  const logoUrls = inputs
    .map((input) => input.logoUrl)
    .filter((logoUrl): logoUrl is string => logoUrl !== null);

  if (logoUrls.length === 0) {
    return;
  }

  const licenses = await fetchCommonsImageLicenses(logoUrls);

  let withLicense = 0;
  for (const input of inputs) {
    if (input.logoUrl === null) {
      continue;
    }
    const license = licenses.get(input.logoUrl);
    if (license === undefined) {
      continue;
    }
    input.logoAttribution = license.attribution;
    input.logoLicense = license.license;
    input.logoLicenseUrl = license.licenseUrl;
    if (license.license !== null) {
      withLicense += 1;
    }
  }

  logger.info({ logos: logoUrls.length, withLicense }, "enriched publisher logo licenses");
}

function entityIdFromUri(uri: string): string {
  return uri.startsWith(ENTITY_URI_PREFIX) ? uri.slice(ENTITY_URI_PREFIX.length) : uri;
}

async function fetchCoreCandidates(): Promise<Map<string, CoreCandidate>> {
  const candidates = new Map<string, CoreCandidate>();

  const global = await runSparql(buildGlobalCoreQuery(), CoreResponseSchema);
  collectCore(candidates, global.results.bindings);
  logger.info({ distinct: candidates.size }, "fetched global core batch");

  const ukrainian = await runSparql(buildUkrainianCoreQuery(), CoreResponseSchema);
  const beforeUkrainian = candidates.size;
  collectCore(candidates, ukrainian.results.bindings);
  logger.info(
    { added: candidates.size - beforeUkrainian, distinct: candidates.size },
    "fetched ukrainian core batch",
  );

  return candidates;
}

async function fetchEnrichment(entityIds: string[]): Promise<Map<string, EnrichedFields>> {
  const enriched = new Map<string, EnrichedFields>();

  for (const batch of chunk(entityIds, ENRICH_BATCH_SIZE)) {
    const response = await runSparql(buildEnrichQuery(batch), EnrichResponseSchema);
    mergeEnrichment(enriched, response.results.bindings);
    logger.info({ enriched: enriched.size, total: entityIds.length }, "enriched batch");
  }

  return enriched;
}

function mergeEnrichment(
  enriched: Map<string, EnrichedFields>,
  bindings: z.infer<typeof EnrichResponseSchema>["results"]["bindings"],
): void {
  for (const binding of bindings) {
    const wikidataId = entityIdFromUri(binding.publisher.value);
    const current = enriched.get(wikidataId) ?? {
      countryCode: null,
      inception: null,
      logo: null,
      publisherLabel: null,
      website: null,
    };

    enriched.set(wikidataId, {
      countryCode: current.countryCode ?? binding.iso?.value ?? null,
      inception: current.inception ?? binding.inception?.value ?? null,
      logo: current.logo ?? binding.logo?.value ?? null,
      publisherLabel: current.publisherLabel ?? binding.publisherLabel?.value ?? null,
      website: current.website ?? binding.website?.value ?? null,
    });
  }
}

async function runSparql<Output>(query: string, schema: z.ZodType<Output>): Promise<Output> {
  const url = new URL(SPARQL_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("query", query);

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Wikidata responded with ${String(response.status)}`);
      }

      return schema.parse(await response.json());
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) {
        break;
      }
      const backoff = RETRY_BASE_DELAY_MS * attempt;
      logger.warn({ attempt, backoff, error: String(error) }, "sparql request failed, retrying");
      await delay(backoff);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function seedPublishers(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.databaseUrl }),
  });

  try {
    const candidates = await fetchCoreCandidates();
    const enriched = await fetchEnrichment([...candidates.keys()]);
    const inputs = buildSeedInputs(candidates, enriched);
    logger.info(
      { candidates: candidates.size, inputs: inputs.length },
      "built publisher seed inputs",
    );

    await enrichLogoLicenses(inputs);

    const upserted = await upsertPublishers(prisma, inputs);
    logger.info({ upserted }, "publisher seed completed");
  } finally {
    await prisma.$disconnect();
  }
}

async function upsertPublishers(
  prisma: PrismaClient,
  inputs: PublisherSeedInput[],
): Promise<number> {
  let upserted = 0;

  for (const batch of chunk(inputs, UPSERT_BATCH_SIZE)) {
    await prisma.$transaction(
      batch.map((input) =>
        prisma.publisher.upsert({
          create: input,
          update: {
            countryCode: input.countryCode,
            foundedYear: input.foundedYear,
            logoAttribution: input.logoAttribution,
            logoLicense: input.logoLicense,
            logoLicenseUrl: input.logoLicenseUrl,
            logoUrl: input.logoUrl,
            name: input.name,
            normalizedName: input.normalizedName,
            websiteUrl: input.websiteUrl,
          },
          where: { wikidataId: input.wikidataId },
        }),
      ),
    );
    upserted += batch.length;
    logger.info({ total: inputs.length, upserted }, "upserted batch");
  }

  return upserted;
}

seedPublishers()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    logger.error({ error: String(error) }, "publisher seed failed");
    process.exit(1);
  });
