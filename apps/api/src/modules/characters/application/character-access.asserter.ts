import type { CharacterInput, Nullable } from "@app/shared";

import { CHARACTER_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { BookAccessService } from "../../books/index.js";
import { MediaService } from "../../media/index.js";
import { TagsService } from "../../tags/index.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";

@Injectable()
export class CharacterAccessAsserter {
  constructor(
    private readonly bookAccess: BookAccessService,
    private readonly mediaService: MediaService,
    private readonly tagsService: TagsService,
    private readonly charactersRepository: CharactersRepository,
  ) {}

  async assertAliasBooksOwned({
    aliases,
    userId,
  }: {
    aliases: CharacterInput["aliases"];
    userId: string;
  }): Promise<void> {
    const bookIds = [
      ...new Set(
        aliases
          .map((alias) => alias.bookId)
          .filter((bookId): bookId is string => bookId !== null && bookId !== undefined),
      ),
    ];
    for (const bookId of bookIds) {
      await this.assertBookOwned({ bookId, userId });
    }
  }

  async assertBookOwned({
    bookId,
    notFoundCode = CHARACTER_ERROR_CODES.bookNotFound,
    userId,
  }: {
    bookId: string;
    notFoundCode?: string;
    userId: string;
  }): Promise<void> {
    await this.bookAccess.assertOwned({
      bookId,
      notFoundCode,
      userId,
    });
  }

  async assertMediaOwned({
    mediaId,
    userId,
  }: {
    mediaId: Nullable<string>;
    userId: string;
  }): Promise<void> {
    if (mediaId === null) {
      return;
    }
    try {
      await this.mediaService.assertOwned({ id: mediaId, userId });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError("Media not found", {
          code: CHARACTER_ERROR_CODES.mediaOwnershipMismatch,
        });
      }
      throw error;
    }
  }

  async assertSeriesOwned({
    notFoundCode = CHARACTER_ERROR_CODES.seriesNotFound,
    seriesId,
    userId,
  }: {
    notFoundCode?: string;
    seriesId: string;
    userId: string;
  }): Promise<void> {
    const owns = await this.charactersRepository.existsOwnedSeries({ seriesId, userId });
    if (!owns) {
      throw new NotFoundError("Series not found", { code: notFoundCode });
    }
  }

  async assertTagsOwned(
    { tagIds, userId }: { tagIds: string[]; userId: string },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    try {
      await this.tagsService.assertAllOwned({ tagIds, userId }, client);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError("Tag not found", {
          code: CHARACTER_ERROR_CODES.tagNotFound,
        });
      }
      throw error;
    }
  }
}
