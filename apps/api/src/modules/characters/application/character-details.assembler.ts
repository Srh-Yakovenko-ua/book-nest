import type { CharacterDetailsView, CharacterRevealFieldKey, ReadingPosition } from "@app/shared";

import { CHARACTER_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  BookContextRow,
  CharacterDetailsRow,
} from "../infrastructure/characters.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildReadingPositionGate, isHiddenByReadingPosition } from "../domain/reading-position.js";
import { resolveAllowedBookIds } from "../domain/series-representative.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterViewMapper } from "./character-view.mapper.js";
import { warnOnAmbiguousSeriesOrder } from "./series-order-warning.js";

@Injectable()
export class CharacterDetailsAssembler {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly viewMapper: CharacterViewMapper,
  ) {}

  async loadDetails(
    args: { bookId?: string; characterId: string; userId: string },
    tx: Prisma.TransactionClient,
  ): Promise<CharacterDetailsRow> {
    const row = await this.charactersRepository.findOwnedCharacterDetails(args, tx);
    if (row === null) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }
    return row;
  }

  async loadFullCharacterDetails({
    characterId,
    revealHiddenProfile,
    userId,
  }: {
    characterId: string;
    revealHiddenProfile: boolean;
    userId: string;
  }): Promise<CharacterDetailsView> {
    const row = await this.charactersRepository.findOwnedCharacterDetails({ characterId, userId });
    if (row === null || (row.hideProfileAsSpoiler && !revealHiddenProfile)) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }
    return this.viewMapper.toDetailsView(row);
  }

  async loadMaskedCharacterDetails({
    characterId,
    contextBookId,
    reader,
    revealFieldIds,
    revealHiddenProfile,
    userId,
  }: {
    characterId: string;
    contextBookId: string;
    reader: ReadingPosition | undefined;
    revealFieldIds: CharacterRevealFieldKey[];
    revealHiddenProfile: boolean;
    userId: string;
  }): Promise<CharacterDetailsView> {
    const contextBook = await this.charactersRepository.findOwnedBookContext({
      bookId: contextBookId,
      userId,
    });
    if (contextBook === null) {
      throw new NotFoundError("Book not found", { code: CHARACTER_ERROR_CODES.bookNotFound });
    }

    const allowedBookIds = await this.resolveContextAllowedBookIds({ contextBook, userId });
    const positionGate = buildReadingPositionGate({ contextBookId, reader });
    const row =
      allowedBookIds.length === 0
        ? null
        : await this.charactersRepository.findOwnedCharacterDetailsInBooks({
            allowedBookIds,
            characterId,
            userId,
          });
    if (row !== null && row.hideProfileAsSpoiler && !revealHiddenProfile) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }
    const visibleAppearances =
      row === null
        ? []
        : row.bookAppearances.filter(
            (appearance) =>
              !appearance.hidePresenceAsSpoiler &&
              !isHiddenByReadingPosition({
                content: {
                  audioSeconds: appearance.firstAppearanceAudioSeconds,
                  chapter: appearance.firstAppearanceChapter,
                  page: appearance.firstAppearancePage,
                },
                contentBookId: appearance.bookId,
                gate: positionGate,
              }),
          );
    if (row === null || visibleAppearances.length === 0) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }

    const revealedFields = new Set(revealFieldIds);
    const allowedBookIdSet = new Set(allowedBookIds);
    const aliases = row.aliases.filter(
      (alias) => !alias.isSpoiler && (alias.bookId === null || allowedBookIdSet.has(alias.bookId)),
    );
    return this.viewMapper.toMaskedDetailsView({
      aliases,
      revealedFields,
      row,
      visibleAppearances,
    });
  }

  private async resolveContextAllowedBookIds({
    contextBook,
    userId,
  }: {
    contextBook: BookContextRow;
    userId: string;
  }): Promise<string[]> {
    if (contextBook.seriesId === null) {
      return [contextBook.id];
    }
    const seriesBooks = await this.charactersRepository.listSeriesBooks({
      seriesId: contextBook.seriesId,
      userId,
    });
    warnOnAmbiguousSeriesOrder({ seriesBooks, seriesId: contextBook.seriesId });
    return resolveAllowedBookIds({ contextBook, includeFuture: false, seriesBooks });
  }
}
