import type {
  CharacterSeriesProfileView,
  CharacterSummaryView,
  Nullable,
  Paginator,
  ReadingContextQuery,
  SeriesCharacterProfileQuery,
  SeriesCharactersQuery,
  SeriesCharacterSummaryQuery,
  SeriesCharacterSummaryView,
  SeriesReadingContextDefaultView,
} from "@app/shared";

import { CHARACTER_ERROR_CODES, normalizeSearch, readingPositionFromQuery } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type {
  ContextualAppearance,
  ReadingContextWindow,
} from "../domain/reading-context-window.js";
import type { BookContextRow } from "../infrastructure/characters.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { buildSeriesCharacterSummary, isTopImportance } from "../domain/character-summary.js";
import { toCharacterSeriesProfileView } from "../domain/character.mapper.js";
import {
  buildReadingContextWindow,
  isAppearanceRevealable,
} from "../domain/reading-context-window.js";
import { warnOnAmbiguousSeriesOrder } from "../domain/series-order-warning.js";
import {
  pickSeriesRepresentatives,
  resolveAllowedBookIds,
  resolveDefaultReadingContext,
  sortSeriesSummaries,
} from "../domain/series-representative.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";
import { CharacterViewMapper } from "./character-view.mapper.js";

type SeriesReadingContext = {
  allowedBookIds: string[];
  contextBookId: Nullable<string>;
  partNumberByBookId: Map<string, Nullable<number>>;
  window: ReadingContextWindow;
};

@Injectable()
export class SeriesCharactersService {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly viewMapper: CharacterViewMapper,
    private readonly accessAsserter: CharacterAccessAsserter,
  ) {}

  async getDefaultSeriesReadingContext({
    seriesId,
    userId,
  }: {
    seriesId: string;
    userId: string;
  }): Promise<SeriesReadingContextDefaultView> {
    await this.accessAsserter.assertSeriesOwned({ seriesId, userId });
    const books = await this.charactersRepository.listSeriesBooksReadingContext({
      seriesId,
      userId,
    });
    warnOnAmbiguousSeriesOrder({ seriesBooks: books, seriesId });
    return resolveDefaultReadingContext({
      books: books.map((book) => ({
        createdAt: book.createdAt,
        finishedAt: book.readingProgress?.finishedAt ?? null,
        id: book.id,
        partNumber: book.partNumber,
      })),
    });
  }

  async getSeriesCharacterProfile({
    characterId,
    query,
    seriesId,
    userId,
  }: {
    characterId: string;
    query: SeriesCharacterProfileQuery;
    seriesId: string;
    userId: string;
  }): Promise<CharacterSeriesProfileView> {
    const context = await this.resolveSeriesReadingContext({
      includeFuture: query.includeFuture ?? false,
      query,
      seriesId,
      userId,
    });

    const character =
      context.allowedBookIds.length === 0
        ? null
        : await this.charactersRepository.findSeriesCharacterProfile({
            allowedBookIds: context.allowedBookIds,
            characterId,
            userId,
          });
    const revealableAppearances =
      character === null
        ? []
        : character.bookAppearances.filter((appearance) =>
            isAppearanceRevealable({ appearance, window: context.window }),
          );
    if (
      character === null ||
      character.hideProfileAsSpoiler ||
      revealableAppearances.length === 0
    ) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }

    const allowedBookIdSet = new Set(context.allowedBookIds);
    const revealableAppearanceIds = new Set(
      revealableAppearances.map((appearance) => appearance.id),
    );
    const maskedBookIds = new Set(
      character.bookAppearances
        .filter((appearance) => !revealableAppearanceIds.has(appearance.id))
        .map((appearance) => appearance.bookId),
    );

    return toCharacterSeriesProfileView({
      aliases: character.aliases.filter(
        (alias) =>
          !alias.isSpoiler &&
          (alias.bookId === null ||
            (allowedBookIdSet.has(alias.bookId) && !maskedBookIds.has(alias.bookId))),
      ),
      appearances: revealableAppearances.map((appearance) => ({
        attitude: appearance.attitude,
        bookId: appearance.bookId,
        createdAt: appearance.createdAt,
        displayName: appearance.displayName,
        displayNameIsSpoiler: appearance.displayNameIsSpoiler,
        id: appearance.id,
        importance: appearance.importance,
        portrait: this.viewMapper.mediaViewOf(appearance.portraitMedia),
        portraitIsSpoiler: appearance.portraitIsSpoiler,
        roles: appearance.roles,
        status: appearance.status,
        statusIsSpoiler: appearance.statusIsSpoiler,
      })),
      avatar: this.viewMapper.mediaViewOf(character.avatarMedia),
      character,
      partNumberByBookId: context.partNumberByBookId,
    });
  }

  async listSeriesCharacters({
    query,
    seriesId,
    userId,
  }: {
    query: SeriesCharactersQuery;
    seriesId: string;
    userId: string;
  }): Promise<Paginator<CharacterSummaryView>> {
    const context = await this.resolveSeriesReadingContext({
      includeFuture: query.includeFuture ?? false,
      query,
      seriesId,
      userId,
    });
    if (context.allowedBookIds.length === 0) {
      return buildPaginator({
        items: [],
        pageNumber: query.pageNumber,
        pageSize: query.pageSize,
        totalCount: 0,
      });
    }

    const appearances = await this.charactersRepository.listSeriesAppearances({
      bookIds: context.allowedBookIds,
      search: normalizeSearch(query.q),
      userId,
    });
    const representatives = pickSeriesRepresentatives({
      appearances: revealableAppearancesIn({ appearances, window: context.window }),
      contextBookId: query.contextBookId,
      partNumberByBookId: context.partNumberByBookId,
    });
    const summaries = representatives.map((row) => this.viewMapper.toSummaryView(row));
    const sorted = sortSeriesSummaries({ sort: query.sort, summaries });

    const { skip: start, take } = pageSlice({
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
    });
    return buildPaginator({
      items: sorted.slice(start, start + take),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount: sorted.length,
    });
  }

  async seriesCharacterSummary({
    query,
    seriesId,
    userId,
  }: {
    query: SeriesCharacterSummaryQuery;
    seriesId: string;
    userId: string;
  }): Promise<SeriesCharacterSummaryView> {
    const context = await this.resolveSeriesReadingContext({
      includeFuture: false,
      query,
      seriesId,
      userId,
    });
    if (context.allowedBookIds.length === 0) {
      return buildSeriesCharacterSummary({
        byImportanceEntries: [],
        contextBookId: context.contextBookId,
        favoritesCount: 0,
        hasHiddenRecords: false,
        povCount: 0,
        seriesId,
        topCandidates: [],
        totalVisibleCharacters: 0,
      });
    }

    const [appearances, hiddenCharacterIds] = await Promise.all([
      this.charactersRepository.listSeriesAppearances({
        bookIds: context.allowedBookIds,
        search: undefined,
        userId,
      }),
      this.charactersRepository.listSeriesHiddenCharacterIds({
        bookIds: context.allowedBookIds,
        userId,
      }),
    ]);

    const representatives = pickSeriesRepresentatives({
      appearances: revealableAppearancesIn({ appearances, window: context.window }),
      contextBookId: query.contextBookId,
      partNumberByBookId: context.partNumberByBookId,
    });
    const visibleCharacterIds = new Set(representatives.map((row) => row.characterId));

    return buildSeriesCharacterSummary({
      byImportanceEntries: representatives.map((row) => ({ count: 1, importance: row.importance })),
      contextBookId: context.contextBookId,
      favoritesCount: representatives.filter((row) => row.character.isFavorite).length,
      hasHiddenRecords:
        hiddenCharacterIds.some((row) => !visibleCharacterIds.has(row.characterId)) ||
        appearances.some((row) => !visibleCharacterIds.has(row.characterId)),
      povCount: representatives.filter((row) => row.isPovCharacter).length,
      seriesId,
      topCandidates: representatives
        .filter((row) => isTopImportance(row.importance))
        .map((row) => this.viewMapper.toSummaryView(row)),
      totalVisibleCharacters: representatives.length,
    });
  }

  private async resolveSeriesReadingContext({
    includeFuture,
    query,
    seriesId,
    userId,
  }: {
    includeFuture: boolean;
    query: ReadingContextQuery;
    seriesId: string;
    userId: string;
  }): Promise<SeriesReadingContext> {
    await this.accessAsserter.assertSeriesOwned({ seriesId, userId });

    let contextBook: Nullable<BookContextRow> = null;
    if (query.contextBookId !== undefined) {
      const resolved = await this.charactersRepository.findOwnedBookContext({
        bookId: query.contextBookId,
        userId,
      });
      if (resolved === null || resolved.seriesId !== seriesId) {
        throw new NotFoundError("Book not found", { code: CHARACTER_ERROR_CODES.bookNotFound });
      }
      contextBook = resolved;
    }

    const seriesBooks = await this.charactersRepository.listSeriesBooks({ seriesId, userId });
    warnOnAmbiguousSeriesOrder({ seriesBooks, seriesId });

    const allowedBookIds = resolveAllowedBookIds({ contextBook, includeFuture, seriesBooks });
    const contextBookId = contextBook?.id ?? null;

    return {
      allowedBookIds,
      contextBookId,
      partNumberByBookId: new Map(seriesBooks.map((book) => [book.id, book.partNumber])),
      window: buildReadingContextWindow({
        allowedBookIds,
        contextBookId,
        readingPosition: readingPositionFromQuery(query),
      }),
    };
  }
}

function revealableAppearancesIn<Appearance extends ContextualAppearance>({
  appearances,
  window,
}: {
  appearances: Appearance[];
  window: ReadingContextWindow;
}): Appearance[] {
  return appearances.filter((appearance) => isAppearanceRevealable({ appearance, window }));
}
