import type {
  CharacterAppearanceBook,
  CharacterBookOrderKey,
  CharacterBooksQuery,
  CharacterCatalogItemView,
  CharacterDetailsQuery,
  CharacterDetailsView,
  CharacterDuplicateCandidatesQuery,
  CharacterDuplicateCandidatesView,
  CharacterOverviewView,
  CharactersListQuery,
  CreateCharacter,
  Paginator,
  UpdateCharacter,
} from "@app/shared";

import {
  CHARACTER_CATALOG_BOOKS_PREVIEW_MAX,
  CHARACTER_DUPLICATE_CANDIDATES_MAX,
  CHARACTER_ERROR_CODES,
  CHARACTER_OVERVIEW_LEADERS_MAX,
  CharactersListQuerySchema,
  normalizeName,
  normalizeSearch,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  CharacterBookCoverRow,
  GlobalCharacterFilter,
} from "../infrastructure/characters.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { buildBookCharacterData } from "../domain/book-character-write.js";
import { groupSortedCharacterBooks } from "../domain/character-books.js";
import {
  buildCharacterData,
  buildCharacterUpdateData,
  buildReplaceAliases,
} from "../domain/character-write.js";
import { toGlobalFilter } from "../domain/global-character-filter.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { BookCharactersService } from "./book-characters.service.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";
import { CharacterDetailsAssembler } from "./character-details.assembler.js";
import { CharacterViewMapper } from "./character-view.mapper.js";
import { GlobalCharacterFilterResolver } from "./global-character-filter.resolver.js";

@Injectable()
export class CharactersService {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly viewMapper: CharacterViewMapper,
    private readonly detailsAssembler: CharacterDetailsAssembler,
    private readonly accessAsserter: CharacterAccessAsserter,
    private readonly bookCharactersService: BookCharactersService,
    private readonly filterResolver: GlobalCharacterFilterResolver,
  ) {}

  async createGlobalCharacter({
    input,
    userId,
  }: {
    input: CreateCharacter;
    userId: string;
  }): Promise<CharacterDetailsView> {
    if (input.firstAppearance !== undefined) {
      await this.accessAsserter.assertBookOwned({ bookId: input.firstAppearance.bookId, userId });
    }
    const characterData = buildCharacterData({ input: input.character, userId });

    const detailsRow = await this.transactionRunner.run(async (tx) => {
      await this.accessAsserter.assertMediaOwned({ mediaId: characterData.avatarMediaId, userId });
      await this.accessAsserter.assertAliasBooksOwned({ aliases: input.character.aliases, userId });
      await this.accessAsserter.assertSpeciesReferenceable(
        { speciesId: characterData.speciesId, userId },
        tx,
      );
      const created = await this.charactersRepository.createCharacter(characterData, tx);

      if (input.firstAppearance !== undefined) {
        const bookCharacterData = buildBookCharacterData({
          bookId: input.firstAppearance.bookId,
          characterId: created.id,
          profile: input.firstAppearance.bookProfile,
        });
        await this.accessAsserter.assertMediaOwned({
          mediaId: bookCharacterData.portraitMediaId,
          userId,
        });
        await this.accessAsserter.assertSpeciesReferenceable(
          { speciesId: bookCharacterData.speciesOverrideId, userId },
          tx,
        );
        await this.bookCharactersService.insertBookCharacter({ data: bookCharacterData, tx });
      }

      return this.detailsAssembler.loadDetails({ characterId: created.id, userId }, tx);
    });

    return this.viewMapper.toDetailsView(detailsRow);
  }

  async duplicateCandidates({
    query,
    userId,
  }: {
    query: CharacterDuplicateCandidatesQuery;
    userId: string;
  }): Promise<CharacterDuplicateCandidatesView> {
    const normalizedNames = new Set<string>();
    const seriesIds = new Set<string>();
    let similarName = normalizeSearch(query.name);

    if (query.name !== undefined) {
      normalizedNames.add(normalizeName(query.name));
    }
    for (const alias of query.aliases ?? []) {
      normalizedNames.add(normalizeName(alias));
    }
    if (query.seriesId !== undefined) {
      await this.accessAsserter.assertSeriesOwned({ seriesId: query.seriesId, userId });
      seriesIds.add(query.seriesId);
    }

    if (query.characterId !== undefined) {
      const signals = await this.charactersRepository.findCharacterDuplicateSignals({
        characterId: query.characterId,
        userId,
      });
      if (signals === null) {
        throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
      }
      normalizedNames.add(signals.normalizedName);
      for (const alias of signals.aliases) {
        normalizedNames.add(alias.normalizedName);
      }
      for (const appearance of signals.bookAppearances) {
        if (appearance.book.seriesId !== null) {
          seriesIds.add(appearance.book.seriesId);
        }
      }
      similarName = similarName ?? normalizeSearch(signals.name);
    }

    const rows = await this.charactersRepository.findDuplicateCandidates({
      excludeCharacterId: query.characterId,
      limit: CHARACTER_DUPLICATE_CANDIDATES_MAX,
      normalizedNames: [...normalizedNames],
      seriesIds: [...seriesIds],
      similarName,
      userId,
    });
    return { candidates: rows.map((row) => this.viewMapper.toGlobalSummaryView(row)) };
  }

  async getCharacterDetails({
    characterId,
    query,
    userId,
  }: {
    characterId: string;
    query: CharacterDetailsQuery;
    userId: string;
  }): Promise<CharacterDetailsView> {
    const revealFieldIds = query.revealFieldIds ?? [];
    if (query.contextBookId === undefined) {
      return this.detailsAssembler.loadMaskedGlobalCharacterDetails({
        characterId,
        revealFieldIds,
        userId,
      });
    }
    return this.detailsAssembler.loadMaskedCharacterDetails({
      characterId,
      contextBookId: query.contextBookId,
      revealFieldIds,
      userId,
    });
  }

  async listCharacterBooks({
    characterId,
    query,
    userId,
  }: {
    characterId: string;
    query: CharacterBooksQuery;
    userId: string;
  }): Promise<Paginator<CharacterAppearanceBook>> {
    await this.accessAsserter.assertCharacterOwned({ characterId, userId });
    const keys = await this.charactersRepository.listBookOrderKeys({
      characterIds: [characterId],
      userId,
    });
    const sortedBooks = groupSortedCharacterBooks(keys).get(characterId) ?? [];
    const { skip, take } = pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize });
    const pageBooks = sortedBooks.slice(skip, skip + take);
    const coverMediaByBookId = await this.loadCoverMediaByBookId({
      bookIds: pageBooks.map((book) => book.id),
      userId,
    });

    return buildPaginator({
      items: this.toAppearanceBookViews({ books: pageBooks, coverMediaByBookId }),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount: sortedBooks.length,
    });
  }

  async listGlobal({
    query,
    userId,
  }: {
    query: CharactersListQuery;
    userId: string;
  }): Promise<Paginator<CharacterCatalogItemView>> {
    const filter = await this.filterResolver.resolve({ query, userId });

    const [rows, totalCount] = await Promise.all([
      this.charactersRepository.listGlobalSummaries({
        filter,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.charactersRepository.countGlobalSummaries(filter),
    ]);
    const booksPreviewByCharacterId = await this.loadBooksPreview({
      characterIds: rows.map((row) => row.id),
      userId,
    });

    return buildPaginator({
      items: rows.map((row) =>
        this.viewMapper.toCatalogItemView({
          booksPreview: booksPreviewByCharacterId.get(row.id) ?? [],
          row,
        }),
      ),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async overview({ userId }: { userId: string }): Promise<CharacterOverviewView> {
    const baseQuery = CharactersListQuerySchema.parse({});
    const baseFilter = (overrides: Partial<CharactersListQuery> = {}): GlobalCharacterFilter =>
      toGlobalFilter({
        duplicateNormalizedNames: undefined,
        multipleBookCharacterIds: undefined,
        query: { ...baseQuery, ...overrides },
        userId,
      });

    const multipleBookCharacterIds = await this.charactersRepository.listMultipleBookCharacterIds({
      userId,
    });

    const [totalCount, favoriteCount, withPersonalImpressionCount, multipleBooksCount, leaders] =
      await Promise.all([
        this.charactersRepository.countGlobalSummaries(baseFilter()),
        this.charactersRepository.countGlobalSummaries(baseFilter({ favorite: true })),
        this.charactersRepository.countGlobalSummaries(baseFilter({ hasPersonalImpression: true })),
        this.charactersRepository.countGlobalSummaries(
          toGlobalFilter({
            duplicateNormalizedNames: undefined,
            multipleBookCharacterIds,
            query: baseQuery,
            userId,
          }),
        ),
        this.charactersRepository.findAppearanceLeaders({
          limit: CHARACTER_OVERVIEW_LEADERS_MAX,
          userId,
        }),
      ]);

    return {
      favoriteCount,
      mostFrequent:
        leaders.leaderCount === 0
          ? null
          : {
              appearanceCount: leaders.appearanceCount,
              leaderCount: leaders.leaderCount,
              leaders: leaders.leaders.map((leader) => ({
                avatar: this.viewMapper.mediaViewOf(leader.avatarMedia),
                id: leader.id,
                name: leader.name,
              })),
            },
      multipleBooksCount,
      totalCount,
      withPersonalImpressionCount,
    };
  }

  async updateGlobal({
    characterId,
    input,
    userId,
  }: {
    characterId: string;
    input: UpdateCharacter;
    userId: string;
  }): Promise<CharacterDetailsView> {
    const detailsRow = await this.transactionRunner.run(async (tx) => {
      const owned = await this.charactersRepository.findOwnedCharacterBare(
        { characterId, userId },
        tx,
      );
      if (owned === null) {
        throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
      }

      if (input.avatarMediaId !== undefined) {
        await this.accessAsserter.assertMediaOwned({
          mediaId: input.avatarMediaId ?? null,
          userId,
        });
      }
      await this.accessAsserter.assertSpeciesReferenceable(
        { speciesId: input.speciesId, userId },
        tx,
      );

      await this.charactersRepository.updateCharacter(
        {
          characterId,
          data: buildCharacterUpdateData({ input, storedGender: owned.gender }),
          userId,
        },
        tx,
      );

      if (input.aliases !== undefined) {
        await this.charactersRepository.replaceAliases(
          {
            aliases: buildReplaceAliases({ aliases: input.aliases, bookId: null }),
            bookId: null,
            characterId,
          },
          tx,
        );
      }

      return this.detailsAssembler.loadDetails({ characterId, userId }, tx);
    });

    return this.viewMapper.toDetailsView(detailsRow);
  }

  private async loadBooksPreview({
    characterIds,
    userId,
  }: {
    characterIds: string[];
    userId: string;
  }): Promise<Map<string, CharacterAppearanceBook[]>> {
    const keys = await this.charactersRepository.listBookOrderKeys({ characterIds, userId });
    const previewBooksByCharacterId = new Map<string, CharacterBookOrderKey[]>();
    for (const [characterId, sortedBooks] of groupSortedCharacterBooks(keys)) {
      previewBooksByCharacterId.set(
        characterId,
        sortedBooks.slice(0, CHARACTER_CATALOG_BOOKS_PREVIEW_MAX),
      );
    }
    const coverMediaByBookId = await this.loadCoverMediaByBookId({
      bookIds: [...previewBooksByCharacterId.values()].flat().map((book) => book.id),
      userId,
    });

    const booksPreviewByCharacterId = new Map<string, CharacterAppearanceBook[]>();
    for (const [characterId, books] of previewBooksByCharacterId) {
      booksPreviewByCharacterId.set(
        characterId,
        this.toAppearanceBookViews({ books, coverMediaByBookId }),
      );
    }
    return booksPreviewByCharacterId;
  }

  private async loadCoverMediaByBookId({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<Map<string, CharacterBookCoverRow["coverMedia"]>> {
    const covers = await this.charactersRepository.listBookCovers({
      bookIds: [...new Set(bookIds)],
      userId,
    });
    return new Map(covers.map((cover) => [cover.id, cover.coverMedia]));
  }

  private toAppearanceBookViews({
    books,
    coverMediaByBookId,
  }: {
    books: CharacterBookOrderKey[];
    coverMediaByBookId: ReadonlyMap<string, CharacterBookCoverRow["coverMedia"]>;
  }): CharacterAppearanceBook[] {
    return books.map((book) =>
      this.viewMapper.toAppearanceBookView({
        book,
        coverMedia: coverMediaByBookId.get(book.id) ?? null,
      }),
    );
  }
}
