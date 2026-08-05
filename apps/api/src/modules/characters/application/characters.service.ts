import type {
  CharacterDetailsQuery,
  CharacterDetailsView,
  CharacterDuplicateCandidatesQuery,
  CharacterDuplicateCandidatesView,
  CharacterGlobalSummaryView,
  CharactersListQuery,
  CreateCharacter,
  Paginator,
  UpdateCharacter,
} from "@app/shared";

import {
  CHARACTER_DUPLICATE_CANDIDATES_MAX,
  CHARACTER_ERROR_CODES,
  normalizeName,
  normalizeSearch,
  readingPositionFromQuery,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { buildBookCharacterData } from "../domain/book-character-write.js";
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

@Injectable()
export class CharactersService {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly viewMapper: CharacterViewMapper,
    private readonly detailsAssembler: CharacterDetailsAssembler,
    private readonly accessAsserter: CharacterAccessAsserter,
    private readonly bookCharactersService: BookCharactersService,
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
    const revealHiddenProfile = query.includeHiddenProfiles ?? false;
    if (query.contextBookId === undefined) {
      return this.detailsAssembler.loadFullCharacterDetails({
        characterId,
        revealHiddenProfile,
        userId,
      });
    }
    return this.detailsAssembler.loadMaskedCharacterDetails({
      characterId,
      contextBookId: query.contextBookId,
      reader: readingPositionFromQuery(query),
      revealFieldIds: query.revealFieldIds ?? [],
      revealHiddenProfile,
      userId,
    });
  }

  async listGlobal({
    query,
    userId,
  }: {
    query: CharactersListQuery;
    userId: string;
  }): Promise<Paginator<CharacterGlobalSummaryView>> {
    if (query.contextBookId !== undefined) {
      await this.accessAsserter.assertBookOwned({ bookId: query.contextBookId, userId });
    }
    const duplicateNormalizedNames = query.possibleDuplicates
      ? await this.charactersRepository.findDuplicateNormalizedNames({
          archived: query.archived ?? false,
          includeHiddenProfiles: query.includeHiddenProfiles ?? false,
          userId,
        })
      : undefined;
    const filter = toGlobalFilter({ duplicateNormalizedNames, query, userId });

    const [rows, totalCount] = await Promise.all([
      this.charactersRepository.listGlobalSummaries({
        filter,
        sort: query.sort,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.charactersRepository.countGlobalSummaries(filter),
    ]);

    return buildPaginator({
      items: rows.map((row) => this.viewMapper.toGlobalSummaryView(row)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
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
}
