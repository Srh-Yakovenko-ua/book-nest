import type { BookFacetScope, BookFacetsView } from "@app/shared";

import { Injectable } from "@nestjs/common";

import { GenresService } from "../../genres/index.js";
import { nameGenreFacets } from "../domain/list-overview.js";
import { BookFacetsRepository } from "../infrastructure/book-facets.repository.js";

type FacetsInput = {
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

  async facets({ scope, search, userId }: FacetsInput): Promise<BookFacetsView> {
    const [authors, genreRows] = await Promise.all([
      this.bookFacetsRepository.authorFacets({ scope, search, userId }),
      this.bookFacetsRepository.genreFacets({ scope, search: undefined, userId }),
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
