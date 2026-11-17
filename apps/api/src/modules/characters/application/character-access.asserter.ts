import type { CharacterInput, Nullable } from "@app/shared";

import { CHARACTER_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { BadRequestError, NotFoundError } from "../../../core/exceptions/errors.js";
import { BookAccessService } from "../../books/index.js";
import { MediaService } from "../../media/index.js";
import { SpeciesService } from "../../species/index.js";
import { TagsService } from "../../tags/index.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";

@Injectable()
export class CharacterAccessAsserter {
  constructor(
    private readonly bookAccess: BookAccessService,
    private readonly mediaService: MediaService,
    private readonly speciesService: SpeciesService,
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

  async assertCharacterInBook({
    bookId,
    characterId,
    notFoundCode = CHARACTER_ERROR_CODES.notFound,
    userId,
  }: {
    bookId: string;
    characterId: string;
    notFoundCode?: string;
    userId: string;
  }): Promise<void> {
    const link = await this.charactersRepository.findOwnedBookCharacter({
      bookId,
      characterId,
      userId,
    });
    if (link === null) {
      throw new NotFoundError("Character not found", { code: notFoundCode });
    }
  }

  async assertCharacterOwned({
    characterId,
    notFoundCode = CHARACTER_ERROR_CODES.notFound,
    userId,
  }: {
    characterId: string;
    notFoundCode?: string;
    userId: string;
  }): Promise<void> {
    const owned = await this.charactersRepository.findOwnedCharacterBare({ characterId, userId });
    if (owned === null) {
      throw new NotFoundError("Character not found", { code: notFoundCode });
    }
  }

  async assertCharactersLinkedToBooks(
    {
      bookIds,
      characterIds,
      invalidCode,
    }: { bookIds: string[]; characterIds: string[]; invalidCode: string },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const uniqueBookIds = [...new Set(bookIds)];
    const uniqueCharacterIds = [...new Set(characterIds)];
    const links = await this.charactersRepository.listBookLinks(
      { bookIds: uniqueBookIds, characterIds: uniqueCharacterIds },
      client,
    );
    if (links.length !== uniqueBookIds.length * uniqueCharacterIds.length) {
      throw new BadRequestError("Every character must appear in the selected book", {
        code: invalidCode,
      });
    }
  }

  async assertCharactersOwned(
    {
      characterIds,
      notFoundCode = CHARACTER_ERROR_CODES.notFound,
      userId,
    }: {
      characterIds: string[];
      notFoundCode?: string;
      userId: string;
    },
    client?: Prisma.TransactionClient,
  ): Promise<void> {
    const uniqueIds = [...new Set(characterIds)];
    const owned = await this.charactersRepository.countOwnedCharacters(
      { characterIds: uniqueIds, userId },
      client,
    );
    if (owned !== uniqueIds.length) {
      throw new NotFoundError("Character not found", { code: notFoundCode });
    }
  }

  async assertMediaOwned({
    mediaId,
    notFoundCode = CHARACTER_ERROR_CODES.mediaOwnershipMismatch,
    userId,
  }: {
    mediaId: Nullable<string>;
    notFoundCode?: string;
    userId: string;
  }): Promise<void> {
    if (mediaId === null) {
      return;
    }
    try {
      await this.mediaService.assertOwned({ id: mediaId, userId });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw new NotFoundError("Media not found", { code: notFoundCode });
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

  async assertSpeciesReferenceable(
    { speciesId, userId }: { speciesId: Nullable<string> | undefined; userId: string },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    if (speciesId === null || speciesId === undefined) {
      return;
    }
    await this.speciesService.assertReferenceable({ speciesId, userId }, client);
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
