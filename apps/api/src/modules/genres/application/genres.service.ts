import type { CreateGenreInput, GenreStatsView, GenreView } from "@app/shared";

import { normalizeName } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import { MediaService } from "../../media/index.js";
import { toGenreStatsViews } from "../domain/genre-stats.mapper.js";
import { toGenreView } from "../domain/genre.mapper.js";
import { GenresRepository } from "../infrastructure/genres.repository.js";

const CUSTOM_GENRE_GROUP_KEY = "custom";
const CUSTOM_GENRE_GROUP_NAME = "Мої жанри";
const GENRE_COVER_PREVIEW_LIMIT = 4;
const GENRE_COVER_SCAN_LIMIT = 500;

@Injectable()
export class GenresService {
  constructor(
    private readonly genresRepository: GenresRepository,
    private readonly mediaService: MediaService,
  ) {}

  async assertGenresSelectable(userId: string, keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const existing = new Set(await this.genresRepository.findSelectableKeys(userId, keys));
    const fields = keys
      .map((key, index) => ({ index, key }))
      .filter((entry) => !existing.has(entry.key))
      .map((entry) => ({ field: `genres.${entry.index}`, message: `Unknown genre: ${entry.key}` }));
    if (fields.length > 0) {
      throw new BadRequestError("Invalid genres", { fields });
    }
  }

  async create(userId: string, input: CreateGenreInput): Promise<GenreView> {
    const normalizedName = normalizeName(input.name);
    if (await this.genresRepository.existsSelectableName(userId, normalizedName)) {
      throw new ConflictError("A genre with this name already exists");
    }
    try {
      const genre = await this.genresRepository.createCustom(userId, {
        groupKey: CUSTOM_GENRE_GROUP_KEY,
        groupName: CUSTOM_GENRE_GROUP_NAME,
        key: randomUUID(),
        name: input.name,
        normalizedName,
      });
      return toGenreView(genre);
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () => new ConflictError("A genre with this name already exists"),
      });
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    const deletedCount = await this.genresRepository.deleteOwnedWithBookCleanup(userId, id);
    if (deletedCount === 0) throw new NotFoundError("Genre not found");
  }

  findNamesByKeys(input: {
    keys: string[];
    userId: string;
  }): Promise<{ key: string; name: string }[]> {
    return this.genresRepository.findNamesByKeys(input);
  }

  async list(userId: string): Promise<GenreView[]> {
    const genres = await this.genresRepository.listAvailable(userId);
    return genres.map(toGenreView);
  }

  async recent({ limit, userId }: { limit: number; userId: string }): Promise<GenreView[]> {
    const keys = await this.genresRepository.recentGenreKeys({ limit, userId });
    if (keys.length === 0) {
      return [];
    }

    const genres = await this.genresRepository.findVisibleByKeys(userId, keys);
    const genreByKey = new Map(genres.map((genre) => [genre.key, genre]));

    return keys.flatMap((key) => {
      const genre = genreByKey.get(key);
      return genre === undefined ? [] : [toGenreView(genre)];
    });
  }

  searchKeys(input: { query: string; userId: string }): Promise<string[]> {
    return this.genresRepository.findKeysByName(input);
  }

  async stats(userId: string): Promise<GenreStatsView[]> {
    const aggregates = await this.genresRepository.aggregateGenreStats(userId);
    if (aggregates.length === 0) {
      return [];
    }

    const [names, coverRows] = await Promise.all([
      this.genresRepository.findNamesByKeys({ keys: aggregates.map((row) => row.key), userId }),
      this.genresRepository.listGenreCovers({ scanLimit: GENRE_COVER_SCAN_LIMIT, userId }),
    ]);

    const labelByKey = new Map(names.map((entry) => [entry.key, entry.name]));
    const coverUrlsByKey = this.buildCoverUrlsByKey(coverRows);

    return toGenreStatsViews({ aggregates, coverUrlsByKey, labelByKey });
  }

  private buildCoverUrlsByKey(
    coverRows: { coverMedia: Parameters<MediaService["buildView"]>[0]; genres: string[] }[],
  ): Map<string, string[]> {
    const urlsByKey = new Map<string, Set<string>>();
    for (const row of coverRows) {
      const thumbUrl = this.mediaService.buildThumbUrlOrNull(row.coverMedia);
      if (thumbUrl === null) {
        continue;
      }
      for (const key of row.genres) {
        const urls = urlsByKey.get(key) ?? new Set<string>();
        if (urls.size < GENRE_COVER_PREVIEW_LIMIT) {
          urls.add(thumbUrl);
          urlsByKey.set(key, urls);
        }
      }
    }
    return new Map([...urlsByKey].map(([key, urls]) => [key, [...urls]]));
  }
}
