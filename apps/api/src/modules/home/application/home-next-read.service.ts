import type { HomeNextReadCandidate, HomeNextReadSource, HomeNextReadView } from "@app/shared";

import { HOME_DASHBOARD_RULES, ReadingStatusSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { HomeTemporalContext } from "../domain/home-temporal-context.js";
import type { NextReadLibraryBook, NextReadPick } from "../domain/next-read-ranking.js";
import type {
  LibraryCandidateRow,
  SeriesBookRow,
} from "../infrastructure/home-next-read.repository.js";
import type { SettledSources } from "./settle-sources.js";

import { createLogger } from "../../../core/logger.js";
import { UserSettingsContextService } from "../../profile/index.js";
import { SeriesOrderCheckService } from "../../series-order-check/index.js";
import { resolveSeriesContinuation, SeriesService } from "../../series/index.js";
import { toHomeTemporalContext } from "../domain/home-temporal-context.js";
import { toNextReadCandidate } from "../domain/next-read-candidate.mapper.js";
import { collectSeriesOrderBlockedBookIds } from "../domain/next-read-eligibility.js";
import {
  mergeNextReadPicks,
  pickFavoriteSeriesCandidates,
  pickQueueCandidates,
  rankLibraryCandidates,
} from "../domain/next-read-ranking.js";
import { HomeNextReadRepository } from "../infrastructure/home-next-read.repository.js";
import { HomeBookFactsLoader } from "./home-book-facts.loader.js";
import { HOME_SOURCE_LIMITS } from "./home-source-limits.js";
import { settleSources } from "./settle-sources.js";

const log = createLogger("home.next-read");

const CANDIDATE_LIMIT = HOME_DASHBOARD_RULES.nextRead.candidateLimit;

const NO_LIBRARY_LOAD: SettledSources<HomeNextReadSource, NextReadPick[]> = {
  failures: [],
  values: [],
};

@Injectable()
export class HomeNextReadService {
  constructor(
    private readonly bookFactsLoader: HomeBookFactsLoader,
    private readonly nextReadRepository: HomeNextReadRepository,
    private readonly seriesOrderCheckService: SeriesOrderCheckService,
    private readonly seriesService: SeriesService,
    private readonly userSettingsContextService: UserSettingsContextService,
  ) {}

  async getNextRead(userId: string): Promise<HomeNextReadView> {
    const temporal = toHomeTemporalContext(
      await this.userSettingsContextService.calendar({ now: new Date(), userId }),
    );

    const prioritized = await settleSources<HomeNextReadSource, NextReadPick[]>([
      { load: () => this.loadQueuePicks(userId), source: "queue" },
      { load: () => this.loadFavoriteSeriesPicks(userId), source: "favorite_series" },
    ]);
    const prioritizedPicks = mergeNextReadPicks({
      limit: CANDIDATE_LIMIT,
      sources: prioritized.values.map((value) => value.data),
    });
    const library =
      prioritizedPicks.length < CANDIDATE_LIMIT
        ? await settleSources<HomeNextReadSource, NextReadPick[]>([
            { load: () => this.loadLibraryPicks({ temporal, userId }), source: "library" },
          ])
        : NO_LIBRARY_LOAD;

    const failures = [...prioritized.failures, ...library.failures];
    for (const failure of failures) {
      log.warn({ source: failure.source, userId }, "home next-read source unavailable");
    }

    const picks = mergeNextReadPicks({
      limit: CANDIDATE_LIMIT,
      sources: [...prioritized.values, ...library.values].map((value) => value.data),
    });

    return {
      candidates: await this.presentCandidates({ picks, userId }),
      unavailableSources: failures.map((failure) => failure.source),
    };
  }

  private async loadFavoriteSeriesPicks(userId: string): Promise<NextReadPick[]> {
    const continuations = await this.seriesService.favoriteContinuations(userId, {
      limit: HOME_SOURCE_LIMITS.fullScan,
    });
    return pickFavoriteSeriesCandidates(
      continuations.items.map((item) => ({
        bookId: item.nextBook.id,
        ownershipStatus: item.nextBook.ownershipStatus,
        rankReason: item.rankReason,
      })),
    );
  }

  private async loadLibraryPicks({
    temporal,
    userId,
  }: {
    temporal: HomeTemporalContext;
    userId: string;
  }): Promise<NextReadPick[]> {
    const rows = await this.nextReadRepository.findLibraryCandidates(userId);
    const books = rows.map(toLibraryBook);
    const seriesIds = [...new Set(books.flatMap((book) => book.seriesId ?? []))];
    const [seriesBooks, disabledSeriesIds] = await Promise.all([
      this.nextReadRepository.findSeriesBooks({ seriesIds, userId }),
      this.nextReadRepository.findDisabledSeriesIds({ seriesIds, userId }),
    ]);

    return rankLibraryCandidates({
      books,
      continuationBySeriesId: resolveContinuations(seriesBooks),
      disabledSeriesIds: new Set(disabledSeriesIds),
      temporal,
    });
  }

  private async loadQueuePicks(userId: string): Promise<NextReadPick[]> {
    const [entries, issues] = await Promise.all([
      this.nextReadRepository.findQueueEntries(userId),
      this.seriesOrderCheckService.listIssues({ limit: HOME_SOURCE_LIMITS.fullScan, userId }),
    ]);
    return pickQueueCandidates({
      blockedBookIds: collectSeriesOrderBlockedBookIds(issues.items),
      entries,
    });
  }

  private async presentCandidates({
    picks,
    userId,
  }: {
    picks: NextReadPick[];
    userId: string;
  }): Promise<HomeNextReadCandidate[]> {
    const factsById = await this.bookFactsLoader.loadFacts({
      bookIds: picks.map((pick) => pick.bookId),
      userId,
    });

    return picks.flatMap((pick): HomeNextReadCandidate[] => {
      const facts = factsById.get(pick.bookId);
      if (facts === undefined) {
        return [];
      }
      const candidate = toNextReadCandidate({ facts, pick });
      return candidate === null ? [] : [candidate];
    });
  }
}

function resolveContinuations(seriesBooks: readonly SeriesBookRow[]): Map<string, string> {
  const booksBySeriesId = new Map<string, SeriesBookRow[]>();
  for (const book of seriesBooks) {
    if (book.seriesId === null) {
      continue;
    }
    const siblings = booksBySeriesId.get(book.seriesId) ?? [];
    siblings.push(book);
    booksBySeriesId.set(book.seriesId, siblings);
  }

  const continuationBySeriesId = new Map<string, string>();
  for (const [seriesId, books] of booksBySeriesId) {
    const resolved = resolveSeriesContinuation(
      books.map((book) => ({
        createdAt: book.createdAt,
        id: book.id,
        partNumber: book.partNumber,
        readingStatus: ReadingStatusSchema.parse(book.readingStatus),
      })),
    );
    if (resolved !== null) {
      continuationBySeriesId.set(seriesId, resolved.continuation.id);
    }
  }
  return continuationBySeriesId;
}

function toLibraryBook(row: LibraryCandidateRow): NextReadLibraryBook {
  return {
    createdAt: row.createdAt,
    id: row.id,
    isFavorite: row.isFavorite,
    readingStatus: row.readingStatus,
    seriesId: row.series === null || row.series.deletedAt !== null ? null : row.seriesId,
  };
}
