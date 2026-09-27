import type { BookFacetScope, BookFacetsView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { GenresService } from "../../genres/index.js";
import { nameGenreFacets } from "../domain/list-overview.js";
import { BookFacetsRepository } from "../infrastructure/book-facets.repository.js";

type FacetsInput = {
  publisherId: string | undefined;
  scope: BookFacetScope;
  search: string | undefined;
  userId: string;
};

@Injectable()
export class BookFacetsService {
  constructor(
    private readonly bookFacetsRepository: BookFacetsRepository,
    private readonly genresService: GenresService,
  ) {}

  async facets({ publisherId, scope, search, userId }: FacetsInput): Promise<BookFacetsView> {
    const [authors, genreRows] = await Promise.all([
      this.bookFacetsRepository.authorFacets({ publisherId, scope, search, userId }),
      this.bookFacetsRepository.genreFacets({
        publisherId,
        scope,
        search: undefined,
        userId,
      }),
    ]);

    if (genreRows.length === 0) {
      return { authors, genres: [] };
    }

    const names = await this.genresService.findNamesByKeys(genreRows.map((row) => row.key));
    const nameByKey = new Map(names.map((entry) => [entry.key, entry.name]));

    return { authors, genres: nameGenreFacets({ nameByKey, rows: genreRows }) };
  }
}
