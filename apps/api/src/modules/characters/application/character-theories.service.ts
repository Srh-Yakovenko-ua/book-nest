import type {
  CharacterTheoriesQuery,
  CharacterTheoryView,
  CreateCharacterTheoryInput,
  Paginator,
  UpdateCharacterTheoryInput,
} from "@app/shared";

import { CHARACTER_THEORY_ERROR_CODES, normalizeSearch } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  CreateTheoryData,
  TheoryListFilter,
  UpdateTheoryData,
} from "../infrastructure/character-theories.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { toCharacterTheoryView } from "../domain/character-theory.mapper.js";
import { resolveContextAllowedBookIds } from "../domain/context-books.js";
import { CharacterTheoriesRepository } from "../infrastructure/character-theories.repository.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";

@Injectable()
export class CharacterTheoriesService {
  constructor(
    private readonly characterTheoriesRepository: CharacterTheoriesRepository,
    private readonly charactersRepository: CharactersRepository,
    private readonly accessAsserter: CharacterAccessAsserter,
  ) {}

  async create({
    input,
    userId,
  }: {
    input: CreateCharacterTheoryInput;
    userId: string;
  }): Promise<CharacterTheoryView> {
    await this.assertTargetsOwned({ input, userId });
    const created = await this.characterTheoriesRepository.create(
      this.buildCreateData({ input, userId }),
    );
    return toCharacterTheoryView(created);
  }

  async list({
    query,
    userId,
  }: {
    query: CharacterTheoriesQuery;
    userId: string;
  }): Promise<Paginator<CharacterTheoryView>> {
    const contextAllowedBookIds =
      query.contextBookId === undefined
        ? undefined
        : await resolveContextAllowedBookIds({
            contextBookId: query.contextBookId,
            notFoundCode: CHARACTER_THEORY_ERROR_CODES.bookNotFound,
            reader: this.charactersRepository,
            userId,
          });

    const filter: TheoryListFilter = {
      bookId: query.bookId,
      characterId: query.characterId,
      contextAllowedBookIds,
      search: normalizeSearch(query.search),
      seriesId: query.seriesId,
      status: query.status,
      userId,
    };

    const [items, totalCount] = await Promise.all([
      this.characterTheoriesRepository.listTheories({
        filter,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.characterTheoriesRepository.countTheories(filter),
    ]);

    return buildPaginator({
      items: items.map((theory) => toCharacterTheoryView(theory)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async remove({ theoryId, userId }: { theoryId: string; userId: string }): Promise<void> {
    const deleted = await this.characterTheoriesRepository.deleteOwned({ theoryId, userId });
    if (deleted === 0) {
      throw new NotFoundError("Theory not found", { code: CHARACTER_THEORY_ERROR_CODES.notFound });
    }
  }

  async update({
    input,
    theoryId,
    userId,
  }: {
    input: UpdateCharacterTheoryInput;
    theoryId: string;
    userId: string;
  }): Promise<CharacterTheoryView> {
    const existing = await this.characterTheoriesRepository.findOwnedById({ theoryId, userId });
    if (existing === null) {
      throw new NotFoundError("Theory not found", { code: CHARACTER_THEORY_ERROR_CODES.notFound });
    }
    const updated = await this.characterTheoriesRepository.update({
      data: this.buildUpdateData(input),
      theoryId,
      userId,
    });
    return toCharacterTheoryView(updated);
  }

  private assertCharacterOwned({
    characterId,
    userId,
  }: {
    characterId: string;
    userId: string;
  }): Promise<void> {
    return this.accessAsserter.assertCharacterOwned({
      characterId,
      notFoundCode: CHARACTER_THEORY_ERROR_CODES.characterNotFound,
      userId,
    });
  }

  private assertSeriesOwned({
    seriesId,
    userId,
  }: {
    seriesId: string;
    userId: string;
  }): Promise<void> {
    return this.accessAsserter.assertSeriesOwned({
      notFoundCode: CHARACTER_THEORY_ERROR_CODES.seriesNotFound,
      seriesId,
      userId,
    });
  }

  private async assertTargetsOwned({
    input,
    userId,
  }: {
    input: CreateCharacterTheoryInput;
    userId: string;
  }): Promise<void> {
    if (input.characterId !== null && input.characterId !== undefined) {
      await this.assertCharacterOwned({ characterId: input.characterId, userId });
    }
    if (input.bookId !== null && input.bookId !== undefined) {
      await this.accessAsserter.assertBookOwned({
        bookId: input.bookId,
        notFoundCode: CHARACTER_THEORY_ERROR_CODES.bookNotFound,
        userId,
      });
    }
    if (input.seriesId !== null && input.seriesId !== undefined) {
      await this.assertSeriesOwned({ seriesId: input.seriesId, userId });
    }
  }

  private buildCreateData({
    input,
    userId,
  }: {
    input: CreateCharacterTheoryInput;
    userId: string;
  }): CreateTheoryData {
    return {
      bookId: input.bookId ?? null,
      characterId: input.characterId ?? null,
      isSpoiler: input.isSpoiler,
      seriesId: input.seriesId ?? null,
      status: input.status,
      text: input.text,
      userId,
    };
  }

  private buildUpdateData(input: UpdateCharacterTheoryInput): UpdateTheoryData {
    const data: UpdateTheoryData = {};
    if (input.text !== undefined) {
      data.text = input.text;
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }
    if (input.isSpoiler !== undefined) {
      data.isSpoiler = input.isSpoiler;
    }
    return data;
  }
}
