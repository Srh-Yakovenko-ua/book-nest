import type { CreateGenreInput, GenreView } from "@app/shared";

import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { normalizeName } from "../../../core/normalize-name.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { toGenreView } from "../domain/genre.mapper.js";
import { GenresRepository } from "../infrastructure/genres.repository.js";

const CUSTOM_GENRE_GROUP_KEY = "custom";
const CUSTOM_GENRE_GROUP_NAME = "Мої жанри";

@Injectable()
export class GenresService {
  constructor(private readonly genresRepository: GenresRepository) {}

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
      if (isUniqueConstraintError(error)) {
        throw new ConflictError("A genre with this name already exists");
      }
      throw error;
    }
  }

  async delete(userId: string, id: string): Promise<void> {
    const deletedCount = await this.genresRepository.deleteOwnedWithBookCleanup(userId, id);
    if (deletedCount === 0) throw new NotFoundError("Genre not found");
  }

  async list(userId: string): Promise<GenreView[]> {
    const genres = await this.genresRepository.listAvailable(userId);
    return genres.map(toGenreView);
  }
}
