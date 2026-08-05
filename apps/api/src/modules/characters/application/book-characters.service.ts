import type {
  BookCharactersQuery,
  BookCharacterSummaryView,
  CharacterDetailsView,
  CharacterSuggestionsQuery,
  CharacterSuggestionsView,
  CharacterSummaryView,
  CreateCharacterInBook,
  Paginator,
  UpdateBookCharacter,
} from "@app/shared";

import { CHARACTER_ERROR_CODES, CHARACTER_SUMMARY_TOP_LIMIT, normalizeSearch } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { CreateBookCharacterData } from "../infrastructure/characters.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { rethrowUniqueConstraintAs } from "../../../core/prisma-errors.js";
import {
  buildBookCharacterData,
  buildBookCharacterUpdateData,
  buildReplaceRoles,
} from "../domain/book-character-write.js";
import { buildBookCharacterSummary } from "../domain/character-summary.js";
import { buildCharacterData, buildReplaceAliases } from "../domain/character-write.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";
import { CharacterDetailsAssembler } from "./character-details.assembler.js";
import { CharacterViewMapper } from "./character-view.mapper.js";

@Injectable()
export class BookCharactersService {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly viewMapper: CharacterViewMapper,
    private readonly detailsAssembler: CharacterDetailsAssembler,
    private readonly accessAsserter: CharacterAccessAsserter,
  ) {}

  async bookCharacterSuggestions({
    bookId,
    query,
    userId,
  }: {
    bookId: string;
    query: CharacterSuggestionsQuery;
    userId: string;
  }): Promise<CharacterSuggestionsView> {
    const context = await this.charactersRepository.findOwnedBookContext({ bookId, userId });
    if (context === null) {
      throw new NotFoundError("Book not found", { code: CHARACTER_ERROR_CODES.bookNotFound });
    }
    const rows = await this.charactersRepository.listSuggestions({
      bookId,
      limit: query.limit,
      search: normalizeSearch(query.q),
      seriesId: context.seriesId,
      userId,
    });
    return { suggestions: rows.map((row) => this.viewMapper.toGlobalSummaryView(row)) };
  }

  async bookCharacterSummary({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<BookCharacterSummaryView> {
    await this.accessAsserter.assertBookOwned({ bookId, userId });

    const [aggregate, topRows] = await Promise.all([
      this.charactersRepository.aggregateBookCharacterSummary({ bookId, userId }),
      this.charactersRepository.listTopBookCharacters({
        bookId,
        limit: CHARACTER_SUMMARY_TOP_LIMIT,
        userId,
      }),
    ]);

    return buildBookCharacterSummary({
      bookId,
      byImportanceEntries: aggregate.byImportance,
      favoritesCount: aggregate.favoritesCount,
      hasHiddenRecords: aggregate.hiddenCount > 0,
      povCount: aggregate.povCount,
      topCandidates: topRows.map((row) => this.viewMapper.toSummaryView(row)),
      totalVisibleCharacters: aggregate.totalVisibleCharacters,
    });
  }

  async createInBook({
    bookId,
    input,
    userId,
  }: {
    bookId: string;
    input: CreateCharacterInBook;
    userId: string;
  }): Promise<CharacterDetailsView> {
    await this.accessAsserter.assertBookOwned({ bookId, userId });

    const detailsRow = await this.transactionRunner.run(async (tx) => {
      const characterId = await this.resolveCharacterForBook({ bookId, input, tx, userId });

      const bookCharacterData = buildBookCharacterData({
        bookId,
        characterId,
        profile: input.bookProfile,
      });
      await this.accessAsserter.assertMediaOwned({
        mediaId: bookCharacterData.portraitMediaId,
        userId,
      });
      await this.insertBookCharacter({ data: bookCharacterData, tx });

      return this.detailsAssembler.loadDetails({ bookId, characterId, userId }, tx);
    });

    return this.viewMapper.toDetailsView(detailsRow);
  }

  async getBookCharacterDetails({
    bookId,
    characterId,
    userId,
  }: {
    bookId: string;
    characterId: string;
    userId: string;
  }): Promise<CharacterDetailsView> {
    await this.accessAsserter.assertBookOwned({ bookId, userId });
    const row = await this.charactersRepository.findOwnedCharacterDetails({
      bookId,
      characterId,
      userId,
    });
    if (row === null || row.hideProfileAsSpoiler || row.bookAppearances.length === 0) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }
    return this.viewMapper.toDetailsView(row);
  }

  async insertBookCharacter({
    data,
    tx,
  }: {
    data: CreateBookCharacterData;
    tx: Prisma.TransactionClient;
  }): Promise<void> {
    try {
      await this.charactersRepository.createBookCharacter(data, tx);
    } catch (error) {
      rethrowUniqueConstraintAs({
        error,
        toError: () =>
          new ConflictError("Character is already linked to this book", {
            code: CHARACTER_ERROR_CODES.alreadyLinkedToBook,
          }),
      });
    }
  }

  async listBookRoster({
    bookId,
    query,
    userId,
  }: {
    bookId: string;
    query: BookCharactersQuery;
    userId: string;
  }): Promise<Paginator<CharacterSummaryView>> {
    await this.accessAsserter.assertBookOwned({ bookId, userId });
    const filter = { bookId, search: normalizeSearch(query.search), userId };

    const [items, totalCount] = await Promise.all([
      this.charactersRepository.listRoster({
        ...filter,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.charactersRepository.countRoster(filter),
    ]);

    return buildPaginator({
      items: items.map((row) => this.viewMapper.toSummaryView(row)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async unlink({
    bookId,
    characterId,
    userId,
  }: {
    bookId: string;
    characterId: string;
    userId: string;
  }): Promise<void> {
    await this.accessAsserter.assertBookOwned({ bookId, userId });

    await this.transactionRunner.run(async (tx) => {
      const bookCharacter = await this.charactersRepository.findOwnedBookCharacter(
        { bookId, characterId, userId },
        tx,
      );
      if (bookCharacter === null) {
        throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
      }
      await this.charactersRepository.deleteBookCharacter(
        { bookCharacterId: bookCharacter.id },
        tx,
      );
      await this.charactersRepository.replaceAliases({ aliases: [], bookId, characterId }, tx);
    });
  }

  async updateBook({
    bookId,
    characterId,
    input,
    userId,
  }: {
    bookId: string;
    characterId: string;
    input: UpdateBookCharacter;
    userId: string;
  }): Promise<CharacterDetailsView> {
    await this.accessAsserter.assertBookOwned({ bookId, userId });

    const detailsRow = await this.transactionRunner.run(async (tx) => {
      const bookCharacter = await this.charactersRepository.findOwnedBookCharacter(
        { bookId, characterId, userId },
        tx,
      );
      if (bookCharacter === null) {
        throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
      }

      if (input.portraitMediaId !== undefined) {
        await this.accessAsserter.assertMediaOwned({
          mediaId: input.portraitMediaId ?? null,
          userId,
        });
      }
      if (input.tagIds !== undefined) {
        await this.accessAsserter.assertTagsOwned({ tagIds: input.tagIds, userId }, tx);
      }

      await this.charactersRepository.updateBookCharacter(
        { bookCharacterId: bookCharacter.id, data: buildBookCharacterUpdateData(input) },
        tx,
      );

      if (input.roles !== undefined) {
        await this.charactersRepository.replaceRoles(
          { bookCharacterId: bookCharacter.id, roles: buildReplaceRoles(input.roles) },
          tx,
        );
      }
      if (input.aliases !== undefined) {
        await this.charactersRepository.replaceAliases(
          {
            aliases: buildReplaceAliases({ aliases: input.aliases, bookId }),
            bookId,
            characterId,
          },
          tx,
        );
      }
      if (input.tagIds !== undefined) {
        await this.charactersRepository.replaceCharacterTags(
          { characterId, tagIds: [...new Set(input.tagIds)] },
          tx,
        );
      }

      return this.detailsAssembler.loadDetails({ bookId, characterId, userId }, tx);
    });

    return this.viewMapper.toDetailsView(detailsRow);
  }

  private async resolveCharacterForBook({
    bookId,
    input,
    tx,
    userId,
  }: {
    bookId: string;
    input: CreateCharacterInBook;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<string> {
    if (input.mode === "new") {
      const characterData = buildCharacterData({ input: input.character, userId });
      await this.accessAsserter.assertMediaOwned({ mediaId: characterData.avatarMediaId, userId });
      await this.accessAsserter.assertAliasBooksOwned({ aliases: input.character.aliases, userId });
      const created = await this.charactersRepository.createCharacter(characterData, tx);
      return created.id;
    }

    const owned = await this.charactersRepository.findOwnedCharacterBare(
      { characterId: input.characterId, userId },
      tx,
    );
    if (owned === null) {
      throw new NotFoundError("Character not found", {
        code: CHARACTER_ERROR_CODES.ownershipMismatch,
      });
    }

    const alreadyLinked = await this.charactersRepository.existsLink(
      { bookId, characterId: input.characterId },
      tx,
    );
    if (alreadyLinked) {
      throw new ConflictError("Character is already linked to this book", {
        code: CHARACTER_ERROR_CODES.alreadyLinkedToBook,
      });
    }

    return input.characterId;
  }
}
