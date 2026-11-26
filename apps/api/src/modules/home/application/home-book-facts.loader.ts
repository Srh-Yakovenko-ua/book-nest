import { Injectable } from "@nestjs/common";

import type { HomeBookFacts } from "../domain/home-book.mapper.js";

import { MediaService } from "../../media/index.js";
import { toHomeBookFacts } from "../domain/home-book.mapper.js";
import { HomeBookPresentationRepository } from "../infrastructure/home-book-presentation.repository.js";

@Injectable()
export class HomeBookFactsLoader {
  constructor(
    private readonly mediaService: MediaService,
    private readonly presentationRepository: HomeBookPresentationRepository,
  ) {}

  async loadFacts({
    bookIds,
    userId,
  }: {
    bookIds: string[];
    userId: string;
  }): Promise<Map<string, HomeBookFacts>> {
    const rows = await this.presentationRepository.findPresentations({ bookIds, userId });
    return new Map(
      rows.map((row) => [
        row.id,
        toHomeBookFacts({ book: row, cover: this.mediaService.buildViewOrNull(row.coverMedia) }),
      ]),
    );
  }
}
