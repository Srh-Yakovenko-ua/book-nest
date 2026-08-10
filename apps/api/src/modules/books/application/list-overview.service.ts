import type { ListOverviewView, ListRelatedView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { GenresService } from "../../genres/index.js";
import { ListsService } from "../../lists/index.js";
import { LIBRARY_OVERVIEW } from "../domain/library-overview.js";
import {
  buildCurrentlyReading,
  countDistinctGenres,
  LIST_OVERVIEW,
  selectTopGenres,
} from "../domain/list-overview.js";
import { ListFacetsRepository } from "../infrastructure/list-facets.repository.js";
import { ListOverviewRepository } from "../infrastructure/list-overview.repository.js";
import { BookViewAssembler } from "./book-view-assembler.js";

type OverviewInput = {
  listId: string;
  userId: string;
};

@Injectable()
export class ListOverviewService {
  constructor(
    private readonly listsService: ListsService,
    private readonly listOverviewRepository: ListOverviewRepository,
    private readonly listFacetsRepository: ListFacetsRepository,
    private readonly genresService: GenresService,
    private readonly viewAssembler: BookViewAssembler,
  ) {}

  async overview({ listId, userId }: OverviewInput): Promise<ListOverviewView> {
    await this.listsService.assertOwned({ listId, userId });

    const scope = { listId, userId };
    const [totalBooks, finishedCount, readingCount, inQueueCount, ownedCount] = await Promise.all([
      this.listOverviewRepository.countTotal(scope),
      this.listOverviewRepository.countByReadingStatus({
        ...scope,
        statuses: LIBRARY_OVERVIEW.finishedStatuses,
      }),
      this.listOverviewRepository.countByReadingStatus({
        ...scope,
        statuses: LIBRARY_OVERVIEW.readingInProgressStatuses,
      }),
      this.listOverviewRepository.countInQueue(scope),
      this.listOverviewRepository.countByOwnership({
        ...scope,
        statuses: LIBRARY_OVERVIEW.physicalOwnershipStatuses,
      }),
    ]);

    const [distinctAuthorsCount, pages, structure] = await Promise.all([
      this.listOverviewRepository.distinctAuthorsCount(scope),
      this.listOverviewRepository.pagesAggregate(scope),
      this.listOverviewRepository.structureCounts(scope),
    ]);

    const [genreRows, readingItem] = await Promise.all([
      this.listFacetsRepository.genreFacets(scope),
      this.listOverviewRepository.findCurrentlyReading({
        ...scope,
        statuses: LIBRARY_OVERVIEW.readingInProgressStatuses,
      }),
    ]);

    const names = await this.genresService.findNamesByKeys({
      keys: genreRows.slice(0, LIST_OVERVIEW.topGenresLimit).map((row) => row.key),
      userId,
    });
    const nameByKey = new Map(names.map((entry) => [entry.key, entry.name]));

    return {
      currentlyReading: buildCurrentlyReading({
        book:
          readingItem === null
            ? undefined
            : { ...this.viewAssembler.viewOf(readingItem.book), position: readingItem.position },
        readingCount,
      }),
      distinctAuthorsCount,
      finishedCount,
      genresCount: countDistinctGenres(genreRows),
      inQueueCount,
      ownedCount,
      pagesKnownCount: pages.knownCount,
      seriesCount: structure.seriesCount,
      soloCount: structure.soloCount,
      topGenres: selectTopGenres({
        limit: LIST_OVERVIEW.topGenresLimit,
        nameByKey,
        rows: genreRows,
      }),
      totalBooks,
      totalPages: pages.totalPages,
    };
  }

  async related({ listId, userId }: OverviewInput): Promise<ListRelatedView> {
    await this.listsService.assertOwned({ listId, userId });
    return { lists: await this.listOverviewRepository.findRelatedLists({ listId, userId }) };
  }
}
