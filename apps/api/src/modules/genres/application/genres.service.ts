import type { GenreView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { BadRequestError } from "../../../core/exceptions/errors.js";
import { toGenreView } from "../domain/genre.mapper.js";
import { GenresRepository } from "../infrastructure/genres.repository.js";

@Injectable()
export class GenresService {
  constructor(private readonly genresRepository: GenresRepository) {}

  async assertGenresSelectable(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const existing = new Set(await this.genresRepository.findSystemKeys(keys));
    const fields = keys
      .map((key, index) => ({ index, key }))
      .filter((entry) => !existing.has(entry.key))
      .map((entry) => ({ field: `genres.${entry.index}`, message: `Unknown genre: ${entry.key}` }));
    if (fields.length > 0) {
      throw new BadRequestError("Invalid genres", { fields });
    }
  }

  findNamesByKeys(keys: string[]): Promise<{ key: string; name: string }[]> {
    return this.genresRepository.findSystemNamesByKeys(keys);
  }

  async list(): Promise<GenreView[]> {
    const genres = await this.genresRepository.listSystem();
    return genres.map(toGenreView);
  }

  async recent({ limit, userId }: { limit: number; userId: string }): Promise<GenreView[]> {
    const keys = await this.genresRepository.recentGenreKeys({ limit, userId });
    if (keys.length === 0) {
      return [];
    }

    const genres = await this.genresRepository.findSystemByKeys(keys);
    const genreByKey = new Map(genres.map((genre) => [genre.key, genre]));

    return keys.flatMap((key) => {
      const genre = genreByKey.get(key);
      return genre === undefined ? [] : [toGenreView(genre)];
    });
  }

  searchKeys(query: string): Promise<string[]> {
    return this.genresRepository.findSystemKeysByName(query);
  }
}
