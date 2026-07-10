import type { Nullable } from "@app/shared";

import { z } from "zod";

import { env } from "../config/env.js";
import { createLogger } from "../core/logger.js";

const logger = createLogger("seed.commons-license");

const COMMONS_API_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const USER_AGENT = env.wikidataContact;
const TITLES_PER_REQUEST = 50;
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 2_000;

const SPECIAL_FILE_PATH_MARKER = "Special:FilePath/";
const WIKI_FILE_MARKER = "/wiki/File:";

const MAX_ATTRIBUTION_LENGTH = 300;
const MAX_LICENSE_LENGTH = 120;

export type CommonsImageLicense = {
  attribution: Nullable<string>;
  license: Nullable<string>;
  licenseUrl: Nullable<string>;
};

const ExtMetadataValueSchema = z.object({ value: z.string() }).partial();

const ExtMetadataSchema = z
  .object({
    Artist: ExtMetadataValueSchema.optional(),
    Credit: ExtMetadataValueSchema.optional(),
    LicenseShortName: ExtMetadataValueSchema.optional(),
    LicenseUrl: ExtMetadataValueSchema.optional(),
  })
  .passthrough();

const ImageInfoSchema = z.object({
  extmetadata: ExtMetadataSchema.optional(),
});

const PageSchema = z.object({
  imageinfo: z.array(ImageInfoSchema).optional(),
  missing: z.boolean().optional(),
  title: z.string(),
});

const NormalizedEntrySchema = z.object({
  from: z.string(),
  to: z.string(),
});

const CommonsResponseSchema = z.object({
  query: z
    .object({
      normalized: z.array(NormalizedEntrySchema).optional(),
      pages: z.array(PageSchema).optional(),
    })
    .optional(),
});

type ExtMetadata = z.infer<typeof ExtMetadataSchema>;

const HTML_ENTITIES: Record<string, string> = {
  "&#039;": "'",
  "&#39;": "'",
  "&amp;": "&",
  "&gt;": ">",
  "&lt;": "<",
  "&nbsp;": " ",
  "&quot;": '"',
};

const HTML_TAG = /<[^>]*>/g;
const HTML_ENTITY = /&(?:amp|lt|gt|quot|nbsp|#0?39);/g;
const ANGLE_BRACKETS = /[<>]/g;
const WHITESPACE = /\s+/g;

export function commonsFileTitleFromUrl(url: string): Nullable<string> {
  const specialIndex = url.indexOf(SPECIAL_FILE_PATH_MARKER);
  if (specialIndex !== -1) {
    const encoded = url.slice(specialIndex + SPECIAL_FILE_PATH_MARKER.length);
    return toFileTitle(stripUrlSuffix(encoded));
  }

  const wikiIndex = url.indexOf(WIKI_FILE_MARKER);
  if (wikiIndex !== -1) {
    const encoded = url.slice(wikiIndex + "/wiki/".length);
    return toFileTitle(stripUrlSuffix(encoded));
  }

  return null;
}

export async function fetchCommonsImageLicenses(
  urls: string[],
): Promise<Map<string, CommonsImageLicense>> {
  const result = new Map<string, CommonsImageLicense>();
  const urlsByTitle = new Map<string, string[]>();

  for (const url of urls) {
    const title = commonsFileTitleFromUrl(url);
    if (title === null) {
      result.set(url, emptyLicense());
      continue;
    }
    const existing = urlsByTitle.get(title);
    if (existing === undefined) {
      urlsByTitle.set(title, [url]);
    } else {
      existing.push(url);
    }
  }

  const titles = [...urlsByTitle.keys()];

  for (const batch of chunk(titles, TITLES_PER_REQUEST)) {
    const byCanonical = await fetchBatch(batch);

    for (const title of batch) {
      const canonical = canonicalizeTitle(title);
      const license = byCanonical.get(canonical) ?? emptyLicense();
      for (const url of urlsByTitle.get(title) ?? []) {
        result.set(url, license);
      }
    }
  }

  return result;
}

export function parseImageExtMetadata(extmetadata: ExtMetadata): CommonsImageLicense {
  const license = cleanLicense(extmetadata.LicenseShortName?.value);
  const licenseUrl = cleanLicenseUrl(extmetadata.LicenseUrl?.value);
  const rawAttribution = extmetadata.Artist?.value ?? extmetadata.Credit?.value ?? null;
  const attribution = rawAttribution === null ? null : cleanAttribution(rawAttribution);

  return {
    attribution: attribution !== null && attribution.length > 0 ? attribution : null,
    license,
    licenseUrl,
  };
}

function canonicalizeTitle(title: string): string {
  const withSpaces = title.replace(/_/g, " ");
  const fileMarker = "File:";
  if (!withSpaces.startsWith(fileMarker)) {
    return capitalizeFirst(withSpaces);
  }
  const name = withSpaces.slice(fileMarker.length);
  return `${fileMarker}${capitalizeFirst(name)}`;
}

function capitalizeFirst(value: string): string {
  if (value.length === 0) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function chunk<Item>(items: Item[], size: number): Item[][] {
  const batches: Item[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

function cleanAttribution(value: string): string {
  const decoded = value.replace(HTML_ENTITY, (entity) => HTML_ENTITIES[entity] ?? entity);
  const withoutTags = decoded.replace(HTML_TAG, " ");
  const withoutBrackets = withoutTags.replace(ANGLE_BRACKETS, "");
  const collapsed = withoutBrackets.replace(WHITESPACE, " ").trim();
  return collapsed.slice(0, MAX_ATTRIBUTION_LENGTH).trim();
}

function cleanLicense(value: string | undefined): Nullable<string> {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, MAX_LICENSE_LENGTH).trim();
}

function cleanLicenseUrl(value: string | undefined): Nullable<string> {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length === 0) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  return trimmed;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function emptyLicense(): CommonsImageLicense {
  return { attribution: null, license: null, licenseUrl: null };
}

async function fetchBatch(titles: string[]): Promise<Map<string, CommonsImageLicense>> {
  const byCanonical = new Map<string, CommonsImageLicense>();

  const response = await requestCommons(titles);
  if (response === null) {
    return byCanonical;
  }

  const normalizedToCanonical = new Map<string, string>();
  for (const entry of response.query?.normalized ?? []) {
    normalizedToCanonical.set(canonicalizeTitle(entry.from), canonicalizeTitle(entry.to));
  }

  for (const page of response.query?.pages ?? []) {
    const canonical = canonicalizeTitle(page.title);
    if (page.missing === true) {
      byCanonical.set(canonical, emptyLicense());
      continue;
    }
    const extmetadata = page.imageinfo?.[0]?.extmetadata;
    byCanonical.set(
      canonical,
      extmetadata === undefined ? emptyLicense() : parseImageExtMetadata(extmetadata),
    );
  }

  for (const [from, to] of normalizedToCanonical) {
    const license = byCanonical.get(to);
    if (license !== undefined) {
      byCanonical.set(from, license);
    }
  }

  return byCanonical;
}

function requestCommons(
  titles: string[],
): Promise<Nullable<z.infer<typeof CommonsResponseSchema>>> {
  return requestWithRetry(titles);
}

async function requestWithRetry(
  titles: string[],
): Promise<Nullable<z.infer<typeof CommonsResponseSchema>>> {
  const url = new URL(COMMONS_API_ENDPOINT);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "extmetadata");
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  url.searchParams.set("titles", titles.join("|"));

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Commons responded with ${String(response.status)}`);
      }

      return CommonsResponseSchema.parse(await response.json());
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) {
        break;
      }
      const backoff = RETRY_BASE_DELAY_MS * attempt;
      logger.warn({ attempt, backoff, error: String(error) }, "commons request failed, retrying");
      await delay(backoff);
    }
  }

  logger.error(
    { error: String(lastError), titles: titles.length },
    "commons batch failed after retries, falling back to null licenses",
  );
  return null;
}

function stripUrlSuffix(value: string): string {
  const queryIndex = value.search(/[?#]/);
  return queryIndex === -1 ? value : value.slice(0, queryIndex);
}

function toFileTitle(encoded: string): Nullable<string> {
  if (encoded.length === 0) {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(encoded);
  } catch {
    decoded = encoded;
  }
  const name = decoded.startsWith("File:") ? decoded.slice("File:".length) : decoded;
  if (name.length === 0) {
    return null;
  }
  return `File:${name}`;
}
