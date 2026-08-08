import type { ListFacetsView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { GenresService } from "../../genres/index.js";
import { ListsService } from "../../lists/index.js";
import { nameGenreFacets } from "../domain/list-overview.js";
import { ListFacetsRepository } from "../infrastructure/list-facets.repository.js";

type FacetsInput = {
  listId: string;
  userId: string;
};

@Injectable()
export class ListFacetsService {
  constructor(
    private readonly listsService: ListsService,
    private readonly listFacetsRepository: ListFacetsRepository,
    private readonly genresService: GenresService,
  ) {}

  async facets({ listId, userId }: FacetsInput): Promise<ListFacetsView> {
    await this.listsService.assertOwned({ listId, userId });

    const [authors, genreRows] = await Promise.all([
      this.listFacetsRepository.authorFacets({ listId, userId }),
      this.listFacetsRepository.genreFacets({ listId, userId }),
    ]);

    if (genreRows.length === 0) {
      return { authors, genres: [] };
    }

    const names = await this.genresService.findNamesByKeys({
      keys: genreRows.map((row) => row.key),
      userId,
    });
    const nameByKey = new Map(names.map((entry) => [entry.key, entry.name]));

    return { authors, genres: nameGenreFacets({ nameByKey, rows: genreRows }) };
  }
}
