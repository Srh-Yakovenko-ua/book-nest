import { Injectable } from "@nestjs/common";
import { z } from "zod";

import { createLogger } from "../../../core/logger.js";

const SEARCH_ENDPOINT = "https://openlibrary.org/search/authors.json";
const AUTHOR_BY_KEY_ENDPOINT = (olid: string): string =>
  `https://openlibrary.org/authors/${olid}.json`;
const WORKS_BY_AUTHOR_ENDPOINT = (olid: string): string =>
  `https://openlibrary.org/authors/${olid}/works.json`;
const REQUEST_TIMEOUT_MS = 8_000;
const RESULT_LIMIT = 10;
const WORKS_LIMIT = 50;
const MISSING_PHOTO_ID = -1;
const PHOTO_BY_OLID = (olid: string): string =>
  `https://covers.openlibrary.org/a/olid/${olid}-M.jpg`;
const PHOTO_BY_ID = (photoId: number): string =>
  `https://covers.openlibrary.org/a/id/${String(photoId)}-L.jpg`;
const WORK_COVER_BY_ID = (coverId: number): string =>
  `https://covers.openlibrary.org/b/id/${String(coverId)}-M.jpg`;

const OpenLibraryAuthorDocSchema = z.object({
  birth_date: z.string().optional(),
  key: z.string(),
  name: z.string().optional(),
});

const OpenLibraryAuthorsResponseSchema = z.object({
  docs: z.array(OpenLibraryAuthorDocSchema),
});

const OpenLibraryBioSchema = z.union([z.string(), z.object({ value: z.string() })]);

const OpenLibraryAuthorDetailSchema = z.object({
  bio: OpenLibraryBioSchema.optional(),
  birth_date: z.string().optional(),
  name: z.string().optional(),
  photos: z.array(z.number()).optional(),
  remote_ids: z.object({ wikidata: z.string().optional() }).optional(),
});

const OpenLibraryWorkEntrySchema = z.object({
  covers: z.array(z.number()).optional(),
  first_publish_year: z.number().nullable().optional(),
  key: z.string(),
  title: z.string().optional(),
});

const OpenLibraryWorksResponseSchema = z.object({
  entries: z.array(OpenLibraryWorkEntrySchema),
});

const BIRTH_YEAR = /\b(\d{4})\b/;
const WORK_KEY_PREFIX = "/works/";

export type OpenLibraryAuthor = {
  birthYear: null | number;
  key: string;
  name: string;
  photoUrl: string;
};

export type OpenLibraryAuthorDetail = {
  bio: null | string;
  birthYear: null | number;
  name: string;
  photoUrl: null | string;
  wikidataId: null | string;
};

export type OpenLibraryWork = {
  coverUrl: null | string;
  firstPublishYear: null | number;
  openLibraryWorkKey: string;
  title: string;
};

const logger = createLogger("authors.open-library");

function coverUrlFromIds(covers: number[] | undefined): null | string {
  const firstCoverId = covers?.find((coverId) => coverId !== MISSING_PHOTO_ID);
  if (firstCoverId === undefined) {
    return null;
  }
  return WORK_COVER_BY_ID(firstCoverId);
}

function normalizeBio(bio: string | undefined | { value: string }): null | string {
  if (bio === undefined) {
    return null;
  }
  const value = typeof bio === "string" ? bio : bio.value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

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

function photoUrlFromIds(photos: number[] | undefined): null | string {
  const firstPhotoId = photos?.[0];
  if (firstPhotoId === undefined || firstPhotoId === MISSING_PHOTO_ID) {
    return null;
  }
  return PHOTO_BY_ID(firstPhotoId);
}

@Injectable()
export class OpenLibraryClient {
  async getAuthorByKey(olid: string): Promise<null | OpenLibraryAuthorDetail> {
    let payload: unknown;
    try {
      const response = await fetch(AUTHOR_BY_KEY_ENDPOINT(olid), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn({ olid, status: response.status }, "open library author fetch responded error");
        return null;
      }
      payload = await response.json();
    } catch (error) {
      logger.warn({ error: String(error), olid }, "open library author fetch failed");
      return null;
    }

    const parsed = OpenLibraryAuthorDetailSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn({ olid }, "open library author returned an unexpected shape");
      return null;
    }

    const name = parsed.data.name?.trim();
    if (name === undefined || name.length === 0) {
      return null;
    }

    return {
      bio: normalizeBio(parsed.data.bio),
      birthYear: parseBirthYear(parsed.data.birth_date),
      name,
      photoUrl: photoUrlFromIds(parsed.data.photos),
      wikidataId: parsed.data.remote_ids?.wikidata ?? null,
    };
  }

  async getWorksByAuthor(olid: string): Promise<OpenLibraryWork[]> {
    const url = new URL(WORKS_BY_AUTHOR_ENDPOINT(olid));
    url.searchParams.set("limit", String(WORKS_LIMIT));

    let payload: unknown;
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        logger.warn(
          { olid, status: response.status },
          "open library works responded with an error",
        );
        return [];
      }
      payload = await response.json();
    } catch (error) {
      logger.warn({ error: String(error), olid }, "open library works request failed");
      return [];
    }

    const parsed = OpenLibraryWorksResponseSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn({ olid }, "open library works returned an unexpected shape");
      return [];
    }

    const works: OpenLibraryWork[] = [];
    for (const entry of parsed.data.entries) {
      const title = entry.title?.trim();
      if (title === undefined || title.length === 0) {
        continue;
      }
      works.push({
        coverUrl: coverUrlFromIds(entry.covers),
        firstPublishYear: entry.first_publish_year ?? null,
        openLibraryWorkKey: entry.key.startsWith(WORK_KEY_PREFIX)
          ? entry.key.slice(WORK_KEY_PREFIX.length)
          : entry.key,
        title,
      });
    }

    return works;
  }

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
