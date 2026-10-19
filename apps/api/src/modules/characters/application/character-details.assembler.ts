import type { CharacterDetailsView, CharacterRevealFieldKey } from "@app/shared";

import { CHARACTER_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { CharacterDetailsRow } from "../infrastructure/characters.repository.js";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { selectVisibleAliases } from "../domain/alias-groups.js";
import { resolveReadingContextWindow } from "../domain/reading-context-window.js";
import { selectVisibleForms } from "../domain/visible-forms.js";
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
    userId,
  }: {
    characterId: string;
    userId: string;
  }): Promise<CharacterDetailsView> {
    const row = await this.charactersRepository.findOwnedCharacterDetails({ characterId, userId });
    if (row === null) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }
    return this.viewMapper.toDetailsView(row);
  }

  async loadMaskedCharacterDetails({
    characterId,
    contextBookId,
    revealFieldIds,
    userId,
  }: {
    characterId: string;
    contextBookId: string;
    revealFieldIds: CharacterRevealFieldKey[];
    userId: string;
  }): Promise<CharacterDetailsView> {
    const window = await resolveReadingContextWindow({
      bookReader: this.charactersRepository,
      contextBookId,
      notFoundCode: CHARACTER_ERROR_CODES.bookNotFound,
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
    if (row === null || row.bookAppearances.length === 0) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }

    const revealedFields = new Set(revealFieldIds);
    return this.viewMapper.toMaskedDetailsView({
      revealedFields,
      row,
      visibleAliases: selectVisibleAliases({ aliases: row.aliases, contextBookId, revealedFields }),
      visibleForms: selectVisibleForms({ forms: row.forms, revealedFields }),
    });
  }

  async loadMaskedGlobalCharacterDetails({
    characterId,
    revealFieldIds,
    userId,
  }: {
    characterId: string;
    revealFieldIds: CharacterRevealFieldKey[];
    userId: string;
  }): Promise<CharacterDetailsView> {
    const row = await this.charactersRepository.findOwnedCharacterDetails({ characterId, userId });
    if (row === null) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }

    const revealedFields = new Set(revealFieldIds);
    return this.viewMapper.toMaskedDetailsView({
      revealedFields,
      row,
      visibleAliases: selectVisibleAliases({
        aliases: row.aliases,
        contextBookId: null,
        revealedFields,
      }),
      visibleForms: selectVisibleForms({ forms: row.forms, revealedFields }),
    });
  }
}
