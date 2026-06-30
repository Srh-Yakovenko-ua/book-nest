import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { env } from "../../../config/env.js";
import { createLogger } from "../../../core/logger.js";

const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";
const REQUEST_TIMEOUT_MS = 8_000;
const WIKIDATA_QID_PATTERN = /^Q\d+$/;
const ISO_YEAR = /^-?\d{4,}/;

const SparqlValueSchema = z.object({ value: z.string() });

const FactsBindingSchema = z.object({
  birth: SparqlValueSchema.optional(),
  death: SparqlValueSchema.optional(),
  iso: SparqlValueSchema.optional(),
});

const FactsResponseSchema = z.object({
  results: z.object({ bindings: z.array(FactsBindingSchema) }),
});

const logger = createLogger("authors.wikidata");

export type WikidataAuthorFacts = {
  birthYear: null | number;
  countryCode: null | string;
  deathYear: null | number;
};

function buildFactsQuery(qid: string): string {
  return `SELECT ?iso ?birth ?death WHERE {
  OPTIONAL { wd:${qid} wdt:P27 ?country . ?country wdt:P297 ?iso . }
  OPTIONAL { wd:${qid} wdt:P569 ?birth . }
  OPTIONAL { wd:${qid} wdt:P570 ?death . }
} LIMIT 1`;
}

function parseYear(isoDateTime: string | undefined): null | number {
  if (isoDateTime === undefined) {
    return null;
  }
  const match = ISO_YEAR.exec(isoDateTime);
  const captured = match?.[0];
  if (captured === undefined) {
    return null;
  }
  const year = Number.parseInt(captured, 10);
  return Number.isNaN(year) ? null : year;
}

@Injectable()
export class WikidataClient {
  async getAuthorFactsByQid(qid: string): Promise<null | WikidataAuthorFacts> {
    if (!WIKIDATA_QID_PATTERN.test(qid)) {
      return null;
    }

    const url = new URL(SPARQL_ENDPOINT);
    url.searchParams.set("format", "json");
    url.searchParams.set("query", buildFactsQuery(qid));

    let payload: unknown;
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/sparql-results+json",
          "User-Agent": env.wikidataContact,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn({ qid, status: response.status }, "wikidata facts responded with an error");
        return null;
      }
      payload = await response.json();
    } catch (error) {
      logger.warn({ error: String(error), qid }, "wikidata facts request failed");
      return null;
    }

    const parsed = FactsResponseSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn({ qid }, "wikidata facts returned an unexpected shape");
      return null;
    }

    const binding = parsed.data.results.bindings[0];
    if (binding === undefined) {
      return { birthYear: null, countryCode: null, deathYear: null };
    }

    const countryCode = binding.iso?.value.trim().toUpperCase();
    return {
      birthYear: parseYear(binding.birth?.value),
      countryCode: countryCode === undefined || countryCode.length === 0 ? null : countryCode,
      deathYear: parseYear(binding.death?.value),
    };
  }
}
