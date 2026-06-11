import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { createLogger } from "../../../core/logger.js";

const SEARCH_ENDPOINT = "https://openlibrary.org/search/authors.json";
const REQUEST_TIMEOUT_MS = 8_000;
const RESULT_LIMIT = 10;
const PHOTO_BY_OLID = (olid: string): string =>
  `https://covers.openlibrary.org/a/olid/${olid}-M.jpg`;

const OpenLibraryAuthorDocSchema = z.object({
  birth_date: z.string().optional(),
  key: z.string(),
  name: z.string().optional(),
});

const OpenLibraryAuthorsResponseSchema = z.object({
  docs: z.array(OpenLibraryAuthorDocSchema),
});

const BIRTH_YEAR = /\b(\d{4})\b/;

export type OpenLibraryAuthor = {
  birthYear: null | number;
  key: string;
  name: string;
  photoUrl: string;
};

const logger = createLogger("authors.open-library");

function parseBirthYear(birthDate: string | undefined): null | number {
  if (birthDate === undefined) {
    return null;
  }
  const match = BIRTH_YEAR.exec(birthDate);
  const captured = match?.[1];
  if (captured === undefined) {
    return null;
  }
  const year = Number.parseInt(captured, 10);
  return Number.isNaN(year) ? null : year;
}

@Injectable()
export class OpenLibraryClient {
  async searchAuthors(query: string): Promise<OpenLibraryAuthor[]> {
    const url = new URL(SEARCH_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(RESULT_LIMIT));

    let payload: unknown;
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn({ status: response.status }, "open library search responded with an error");
        return [];
      }
      payload = await response.json();
    } catch (error) {
      logger.warn({ error: String(error) }, "open library search request failed");
      return [];
    }

    const parsed = OpenLibraryAuthorsResponseSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn("open library search returned an unexpected shape");
      return [];
    }

    const authors: OpenLibraryAuthor[] = [];
    for (const doc of parsed.data.docs) {
      const name = doc.name?.trim();
      if (name === undefined || name.length === 0) {
        continue;
      }
      authors.push({
        birthYear: parseBirthYear(doc.birth_date),
        key: doc.key,
        name,
        photoUrl: PHOTO_BY_OLID(doc.key),
      });
      if (authors.length >= RESULT_LIMIT) {
        break;
      }
    }

    return authors;
  }
}
