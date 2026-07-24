import type {
  CharacterGraphLayoutKeyQuery,
  CharacterGraphLayoutScopeType,
  CharacterGraphLayoutView,
  Nullable,
  SaveCharacterGraphLayout,
} from "@app/shared";

import { CHARACTER_GRAPH_LAYOUT_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { CharacterGraphLayoutKey } from "../infrastructure/character-graph-layouts.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { assertBookOwned, BooksRepository } from "../../books/index.js";
import { toCharacterGraphLayoutView } from "../domain/character-graph-layout.mapper.js";
import { CharacterGraphLayoutsRepository } from "../infrastructure/character-graph-layouts.repository.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";

@Injectable()
export class CharacterGraphLayoutsService {
  constructor(
    private readonly layoutsRepository: CharacterGraphLayoutsRepository,
    private readonly charactersRepository: CharactersRepository,
    private readonly booksRepository: BooksRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async get({
    query,
    userId,
  }: {
    query: CharacterGraphLayoutKeyQuery;
    userId: string;
  }): Promise<CharacterGraphLayoutView> {
    const layout = await this.layoutsRepository.findByKey(this.toKey({ input: query, userId }));
    if (layout === null) {
      throw new NotFoundError("Character graph layout not found", {
        code: CHARACTER_GRAPH_LAYOUT_ERROR_CODES.notFound,
      });
    }
    return toCharacterGraphLayoutView(layout);
  }

  async remove({
    query,
    userId,
  }: {
    query: CharacterGraphLayoutKeyQuery;
    userId: string;
  }): Promise<void> {
    const deleted = await this.layoutsRepository.deleteByKey(this.toKey({ input: query, userId }));
    if (deleted === 0) {
      throw new NotFoundError("Character graph layout not found", {
        code: CHARACTER_GRAPH_LAYOUT_ERROR_CODES.notFound,
      });
    }
  }

  async save({
    input,
    userId,
  }: {
    input: SaveCharacterGraphLayout;
    userId: string;
  }): Promise<CharacterGraphLayoutView> {
    const key = this.toKey({ input, userId });
    await this.assertScopeOwned({ scopeId: key.scopeId, scopeType: input.scopeType, userId });
    if (key.contextBookId !== null) {
      await this.assertBookOwned({ bookId: key.contextBookId, userId });
    }

    const data = {
      ...key,
      layoutVersion: input.layoutVersion,
      positions: input.positions,
      viewport: input.viewport ?? null,
    };

    const layout = await this.transactionRunner.run(async (tx) => {
      await this.layoutsRepository.acquireLayoutLock(key, tx);
      const existing = await this.layoutsRepository.findByKey(key, tx);
      if (existing === null) {
        return this.layoutsRepository.createLayout(data, tx);
      }
      return this.layoutsRepository.updateLayout({ data, id: existing.id }, tx);
    });

    return toCharacterGraphLayoutView(layout);
  }

  private async assertBookOwned({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<void> {
    await assertBookOwned({
      bookId,
      booksRepository: this.booksRepository,
      notFoundCode: CHARACTER_GRAPH_LAYOUT_ERROR_CODES.bookNotFound,
      userId,
    });
  }

  private async assertScopeOwned({
    scopeId,
    scopeType,
    userId,
  }: {
    scopeId: Nullable<string>;
    scopeType: CharacterGraphLayoutScopeType;
    userId: string;
  }): Promise<void> {
    switch (scopeType) {
      case "book":
        await this.assertBookOwned({ bookId: this.requireScopeId(scopeId), userId });
        return;
      case "global":
        return;
      case "series":
        await this.assertSeriesOwned({ seriesId: this.requireScopeId(scopeId), userId });
        return;
      default:
        assertNever(scopeType);
    }
  }

  private async assertSeriesOwned({
    seriesId,
    userId,
  }: {
    seriesId: string;
    userId: string;
  }): Promise<void> {
    const owned = await this.charactersRepository.existsOwnedSeries({ seriesId, userId });
    if (!owned) {
      throw new NotFoundError("Series not found", {
        code: CHARACTER_GRAPH_LAYOUT_ERROR_CODES.seriesNotFound,
      });
    }
  }

  private requireScopeId(scopeId: Nullable<string>): string {
    if (scopeId === null) {
      throw new ValidationError("scopeId is required when scopeType is book or series", {
        code: CHARACTER_GRAPH_LAYOUT_ERROR_CODES.validationFailed,
      });
    }
    return scopeId;
  }

  private toKey({
    input,
    userId,
  }: {
    input: CharacterGraphLayoutKeyQuery | SaveCharacterGraphLayout;
    userId: string;
  }): CharacterGraphLayoutKey {
    return {
      contextBookId: input.contextBookId ?? null,
      mode: input.mode,
      scopeId: input.scopeId ?? null,
      scopeType: input.scopeType,
      userId,
    };
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected scope type: ${String(value)}`);
}
