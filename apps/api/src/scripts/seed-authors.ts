import type { Nullable } from "@app/shared";

import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { env } from "../config/env.js";
import { createLogger } from "../core/logger.js";
import { PrismaClient } from "../generated/prisma/client.js";
import { fetchCommonsImageLicenses } from "./fetch-commons-image-license.js";
import { type AuthorSeedInput, mapWikidataAuthorRow } from "./map-wikidata-author-row.js";

const logger = createLogger("seed.authors");

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = env.wikidataContact;
const AUTHOR_OCCUPATIONS = ["Q36180", "Q6625963", "Q49757", "Q214917"];
const UKRAINIAN_CITIZENSHIPS = ["Q212", "Q15180"];
const GLOBAL_MIN_SITELINKS = 80;
const UKRAINIAN_MIN_SITELINKS = 25;
const ENRICH_BATCH_SIZE = 200;
const UPSERT_BATCH_SIZE = 10;
const UPSERT_TRANSACTION_TIMEOUT_MS = 30_000;
const UPSERT_TRANSACTION_MAX_WAIT_MS = 10_000;
const TARGET_AUTHOR_CAP = 2000;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 2_000;

const ENTITY_URI_PREFIX = "http://www.wikidata.org/entity/";

const SparqlValueSchema = z.object({ value: z.string() });

const CoreBindingSchema = z.object({
  author: SparqlValueSchema,
  olid: SparqlValueSchema.optional(),
  sitelinks: SparqlValueSchema,
});

const CoreResponseSchema = z.object({
  results: z.object({ bindings: z.array(CoreBindingSchema) }),
});

const EnrichBindingSchema = z.object({
  aliasEn: SparqlValueSchema.optional(),
  aliasRu: SparqlValueSchema.optional(),
  aliasUk: SparqlValueSchema.optional(),
  author: SparqlValueSchema,
  birth: SparqlValueSchema.optional(),
  death: SparqlValueSchema.optional(),
  descEn: SparqlValueSchema.optional(),
  image: SparqlValueSchema.optional(),
  iso: SparqlValueSchema.optional(),
  labelEn: SparqlValueSchema.optional(),
  labelUk: SparqlValueSchema.optional(),
  olid: SparqlValueSchema.optional(),
});

const EnrichResponseSchema = z.object({
  results: z.object({ bindings: z.array(EnrichBindingSchema) }),
});

type CoreCandidate = {
  openLibraryKey: Nullable<string>;
  sitelinks: number;
  wikidataId: string;
};

type EnrichedFields = {
  aliasEn: Nullable<string>;
  aliasRu: Nullable<string>;
  aliasUk: Nullable<string>;
  birth: Nullable<string>;
  countryCode: Nullable<string>;
  death: Nullable<string>;
  descEn: Nullable<string>;
  image: Nullable<string>;
  labelEn: Nullable<string>;
  labelUk: Nullable<string>;
  openLibraryKey: Nullable<string>;
};

function buildEnrichQuery(entityIds: string[]): string {
  const values = entityIds.map((id) => `wd:${id}`).join(" ");
  return `SELECT ?author ?labelEn ?labelUk ?descEn ?image ?iso ?birth ?death ?olid
  (GROUP_CONCAT(DISTINCT ?altEnRaw; separator="|") AS ?aliasEn)
  (GROUP_CONCAT(DISTINCT ?altUkRaw; separator="|") AS ?aliasUk)
  (GROUP_CONCAT(DISTINCT ?altRuRaw; separator="|") AS ?aliasRu)
WHERE {
  VALUES ?author { ${values} }
  OPTIONAL { ?author rdfs:label ?labelEn . FILTER(LANG(?labelEn) = "en") }
  OPTIONAL { ?author rdfs:label ?labelUk . FILTER(LANG(?labelUk) = "uk") }
  OPTIONAL { ?author schema:description ?descEn . FILTER(LANG(?descEn) = "en") }
  OPTIONAL { ?author wdt:P18 ?image . }
  OPTIONAL { ?author wdt:P27 ?country . ?country wdt:P297 ?iso . }
  OPTIONAL { ?author wdt:P569 ?birth . }
  OPTIONAL { ?author wdt:P570 ?death . }
  OPTIONAL { ?author wdt:P648 ?olid . }
  OPTIONAL { ?author skos:altLabel ?altEnRaw . FILTER(LANG(?altEnRaw) = "en") }
  OPTIONAL { ?author skos:altLabel ?altUkRaw . FILTER(LANG(?altUkRaw) = "uk") }
  OPTIONAL { ?author skos:altLabel ?altRuRaw . FILTER(LANG(?altRuRaw) = "ru") }
}
GROUP BY ?author ?labelEn ?labelUk ?descEn ?image ?iso ?birth ?death ?olid`;
}

function buildGlobalCoreQuery(occupation: string): string {
  return `SELECT ?author ?olid ?sitelinks WHERE {
  ?author wdt:P106 wd:${occupation} .
  ?author wikibase:sitelinks ?sitelinks . FILTER(?sitelinks >= ${String(GLOBAL_MIN_SITELINKS)})
  OPTIONAL { ?author wdt:P648 ?olid . }
} LIMIT 5000`;
}

function buildSeedInputs(
  candidates: Map<string, CoreCandidate>,
  enriched: Map<string, EnrichedFields>,
): AuthorSeedInput[] {
  const ranked = [...candidates.values()].sort((left, right) => right.sitelinks - left.sitelinks);
  const seen = new Set<string>();
  const inputs: AuthorSeedInput[] = [];

  for (const candidate of ranked) {
    if (inputs.length >= TARGET_AUTHOR_CAP) {
      break;
    }
    const fields = enriched.get(candidate.wikidataId);
    if (fields === undefined) {
      continue;
    }

    const seedInput = mapWikidataAuthorRow({
      aliasEn: fields.aliasEn,
      aliasRu: fields.aliasRu,
      aliasUk: fields.aliasUk,
      authorDescription: fields.descEn,
      birth: fields.birth,
      countryCode: fields.countryCode,
      death: fields.death,
      image: fields.image,
      labelEn: fields.labelEn,
      labelUk: fields.labelUk,
      openLibraryKey: candidate.openLibraryKey ?? fields.openLibraryKey,
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
  const occupationValues = AUTHOR_OCCUPATIONS.map((id) => `wd:${id}`).join(" ");
  const citizenshipValues = UKRAINIAN_CITIZENSHIPS.map((id) => `wd:${id}`).join(" ");
  return `SELECT ?author ?olid ?sitelinks WHERE {
  ?author wdt:P106 ?occ .
  VALUES ?occ { ${occupationValues} }
  VALUES ?citizenship { ${citizenshipValues} }
  ?author wdt:P27 ?citizenship .
  ?author wikibase:sitelinks ?sitelinks . FILTER(?sitelinks > ${String(UKRAINIAN_MIN_SITELINKS)})
  OPTIONAL { ?author wdt:P648 ?olid . }
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
    const wikidataId = entityIdFromUri(binding.author.value);
    const sitelinks = Number.parseInt(binding.sitelinks.value, 10);
    const openLibraryKey = binding.olid?.value ?? null;

    const existing = candidates.get(wikidataId);
    if (existing === undefined) {
      candidates.set(wikidataId, { openLibraryKey, sitelinks, wikidataId });
      continue;
    }
    if (existing.openLibraryKey === null && openLibraryKey !== null) {
      existing.openLibraryKey = openLibraryKey;
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function enrichPhotoLicenses(inputs: AuthorSeedInput[]): Promise<void> {
  const photoUrls = inputs
    .map((input) => input.photoUrl)
    .filter((photoUrl): photoUrl is string => photoUrl !== null);

  if (photoUrls.length === 0) {
    return;
  }

  const licenses = await fetchCommonsImageLicenses(photoUrls);

  let withLicense = 0;
  for (const input of inputs) {
    if (input.photoUrl === null) {
      continue;
    }
    const license = licenses.get(input.photoUrl);
    if (license === undefined) {
      continue;
    }
    input.photoAttribution = license.attribution;
    input.photoLicense = license.license;
    input.photoLicenseUrl = license.licenseUrl;
    if (license.license !== null) {
      withLicense += 1;
    }
  }

  logger.info({ photos: photoUrls.length, withLicense }, "enriched author photo licenses");
}

function entityIdFromUri(uri: string): string {
  return uri.startsWith(ENTITY_URI_PREFIX) ? uri.slice(ENTITY_URI_PREFIX.length) : uri;
}

async function fetchCoreCandidates(): Promise<Map<string, CoreCandidate>> {
  const candidates = new Map<string, CoreCandidate>();

  for (const occupation of AUTHOR_OCCUPATIONS) {
    const response = await runSparql(buildGlobalCoreQuery(occupation), CoreResponseSchema);
    collectCore(candidates, response.results.bindings);
    logger.info(
      { distinct: candidates.size, occupation },
      "fetched global core batch by occupation",
    );
  }

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
    const wikidataId = entityIdFromUri(binding.author.value);
    const current = enriched.get(wikidataId) ?? {
      aliasEn: null,
      aliasRu: null,
      aliasUk: null,
      birth: null,
      countryCode: null,
      death: null,
      descEn: null,
      image: null,
      labelEn: null,
      labelUk: null,
      openLibraryKey: null,
    };

    enriched.set(wikidataId, {
      aliasEn: current.aliasEn ?? toNullableAlias(binding.aliasEn?.value),
      aliasRu: current.aliasRu ?? toNullableAlias(binding.aliasRu?.value),
      aliasUk: current.aliasUk ?? toNullableAlias(binding.aliasUk?.value),
      birth: current.birth ?? binding.birth?.value ?? null,
      countryCode: current.countryCode ?? binding.iso?.value ?? null,
      death: current.death ?? binding.death?.value ?? null,
      descEn: current.descEn ?? binding.descEn?.value ?? null,
      image: current.image ?? binding.image?.value ?? null,
      labelEn: current.labelEn ?? binding.labelEn?.value ?? null,
      labelUk: current.labelUk ?? binding.labelUk?.value ?? null,
      openLibraryKey: current.openLibraryKey ?? binding.olid?.value ?? null,
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

async function seedAuthors(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.databaseUrl }),
  });

  try {
    const candidates = await fetchCoreCandidates();
    const enriched = await fetchEnrichment([...candidates.keys()]);
    const inputs = buildSeedInputs(candidates, enriched);
    logger.info({ candidates: candidates.size, inputs: inputs.length }, "built author seed inputs");

    await enrichPhotoLicenses(inputs);

    const upserted = await upsertAuthors(prisma, inputs);
    logger.info({ upserted }, "author seed completed");
  } finally {
    await prisma.$disconnect();
  }
}

function toNullableAlias(value: string | undefined): Nullable<string> {
  if (value === undefined || value.length === 0) {
    return null;
  }
  return value;
}

async function upsertAuthors(prisma: PrismaClient, inputs: AuthorSeedInput[]): Promise<number> {
  let upserted = 0;

  for (const batch of chunk(inputs, UPSERT_BATCH_SIZE)) {
    await prisma.$transaction(
      async (tx) => {
        for (const input of batch) {
          const author = await tx.author.upsert({
            create: {
              bio: input.bio,
              birthYear: input.birthYear,
              countryCode: input.countryCode,
              deathYear: input.deathYear,
              name: input.name,
              normalizedName: input.normalizedName,
              openLibraryKey: input.openLibraryKey,
              photoAttribution: input.photoAttribution,
              photoLicense: input.photoLicense,
              photoLicenseUrl: input.photoLicenseUrl,
              photoUrl: input.photoUrl,
              searchText: input.searchText,
              userId: input.userId,
              wikidataId: input.wikidataId,
            },
            select: { id: true },
            update: {
              bio: input.bio,
              birthYear: input.birthYear,
              countryCode: input.countryCode,
              deathYear: input.deathYear,
              name: input.name,
              normalizedName: input.normalizedName,
              openLibraryKey: input.openLibraryKey,
              photoAttribution: input.photoAttribution,
              photoLicense: input.photoLicense,
              photoLicenseUrl: input.photoLicenseUrl,
              photoUrl: input.photoUrl,
              searchText: input.searchText,
            },
            where: { wikidataId: input.wikidataId },
          });

          await tx.authorName.deleteMany({ where: { authorId: author.id } });
          await tx.authorName.createMany({
            data: input.names.map((authorName) => ({
              authorId: author.id,
              isPrimary: authorName.isPrimary,
              locale: authorName.locale,
              name: authorName.name,
              normalizedName: authorName.normalizedName,
            })),
          });
        }
      },
      { maxWait: UPSERT_TRANSACTION_MAX_WAIT_MS, timeout: UPSERT_TRANSACTION_TIMEOUT_MS },
    );
    upserted += batch.length;
    logger.info({ total: inputs.length, upserted }, "upserted batch");
  }

  return upserted;
}

seedAuthors()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    logger.error({ error: String(error) }, "author seed failed");
    process.exit(1);
  });
