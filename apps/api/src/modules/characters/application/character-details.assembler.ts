import type { CharacterDetailsView, CharacterRevealFieldKey, ReadingPosition } from "@app/shared";

import { CHARACTER_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { CharacterDetailsRow } from "../infrastructure/characters.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import {
  isAppearanceRevealable,
  resolveReadingContextWindow,
} from "../domain/reading-context-window.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterViewMapper } from "./character-view.mapper.js";

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
    const window = await resolveReadingContextWindow({
      bookReader: this.charactersRepository,
      contextBookId,
      notFoundCode: CHARACTER_ERROR_CODES.bookNotFound,
      readingPosition: reader,
      userId,
    });
    const allowedBookIds = [...window.allowedBookIds];
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
        : row.bookAppearances.filter((appearance) =>
            isAppearanceRevealable({ appearance, window }),
          );
    if (row === null || visibleAppearances.length === 0) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }

    const revealedFields = new Set(revealFieldIds);
    const aliases = row.aliases.filter(
      (alias) =>
        !alias.isSpoiler && (alias.bookId === null || window.allowedBookIds.has(alias.bookId)),
    );
    return this.viewMapper.toMaskedDetailsView({
      aliases,
      revealedFields,
      row,
      visibleAppearances,
    });
  }
}
