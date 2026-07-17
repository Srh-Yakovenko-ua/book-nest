import type {
  BookCharacterProfileInput,
  BookCharactersQuery,
  BookCharacterView,
  CharacterDetailsView,
  CharacterInput,
  CharacterSummaryView,
  CreateCharacter,
  CreateCharacterInBook,
  MediaView,
  Nullable,
  Paginator,
} from "@app/shared";

import { CHARACTER_ERROR_CODES, normalizeName, normalizeSearch } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type { CharacterDetailsRow, RosterRow } from "../infrastructure/characters.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { BooksRepository } from "../../books/index.js";
import { MediaService } from "../../media/index.js";
import { emptyToNull } from "../domain/character-fields.js";
import {
  toBookCharacterView,
  toCharacterDetailsView,
  toCharacterSummaryView,
} from "../domain/character.mapper.js";
import {
  CharactersRepository,
  type CreateAliasData,
  type CreateBookCharacterData,
  type CreateCharacterData,
} from "../infrastructure/characters.repository.js";

const log = createLogger("characters");

@Injectable()
export class CharactersService {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly booksRepository: BooksRepository,
    private readonly mediaService: MediaService,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async createGlobalCharacter(
    userId: string,
    input: CreateCharacter,
  ): Promise<CharacterDetailsView> {
    if (input.firstAppearance !== undefined) {
      await this.assertBookOwned(userId, input.firstAppearance.bookId);
    }
    const characterData = this.buildCharacterData(userId, input.character);

    const detailsRow = await this.transactionRunner.run(async (tx) => {
      await this.assertMediaOwned(userId, characterData.avatarMediaId);
      await this.assertAliasBooksOwned(userId, input.character.aliases);
      const created = await this.charactersRepository.createCharacter(characterData, tx);

      if (input.firstAppearance !== undefined) {
        const bookCharacterData = this.buildBookCharacterData({
          bookId: input.firstAppearance.bookId,
          characterId: created.id,
          profile: input.firstAppearance.bookProfile,
        });
        await this.assertMediaOwned(userId, bookCharacterData.portraitMediaId);
        await this.insertBookCharacter({ data: bookCharacterData, tx });
      }

      return this.loadDetails({ characterId: created.id, userId }, tx);
    });

    return this.toDetailsView(detailsRow);
  }

  async createInBook(
    userId: string,
    bookId: string,
    input: CreateCharacterInBook,
  ): Promise<CharacterDetailsView> {
    await this.assertBookOwned(userId, bookId);

    const detailsRow = await this.transactionRunner.run(async (tx) => {
      const characterId = await this.resolveCharacterForBook({ bookId, input, tx, userId });

      const bookCharacterData = this.buildBookCharacterData({
        bookId,
        characterId,
        profile: input.bookProfile,
      });
      await this.assertMediaOwned(userId, bookCharacterData.portraitMediaId);
      await this.insertBookCharacter({ data: bookCharacterData, tx });

      return this.loadDetails({ bookId, characterId, userId }, tx);
    });

    return this.toDetailsView(detailsRow);
  }

  async getBookCharacterDetails(
    userId: string,
    bookId: string,
    characterId: string,
  ): Promise<CharacterDetailsView> {
    await this.assertBookOwned(userId, bookId);
    const row = await this.charactersRepository.findOwnedCharacterDetails({
      bookId,
      characterId,
      userId,
    });
    if (row === null || row.bookAppearances.length === 0) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }
    return this.toDetailsView(row);
  }

  async getCharacterDetails(userId: string, characterId: string): Promise<CharacterDetailsView> {
    const row = await this.charactersRepository.findOwnedCharacterDetails({ characterId, userId });
    if (row === null) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }
    return this.toDetailsView(row);
  }

  async listBookRoster(
    userId: string,
    bookId: string,
    query: BookCharactersQuery,
  ): Promise<Paginator<CharacterSummaryView>> {
    await this.assertBookOwned(userId, bookId);
    const filter = { bookId, search: normalizeSearch(query.search), userId };

    const [items, totalCount] = await Promise.all([
      this.charactersRepository.listRoster({
        ...filter,
        skip: (query.pageNumber - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.charactersRepository.countRoster(filter),
    ]);

    return buildPaginator({
      items: items.map((row) => this.toSummaryView(row)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  private async assertAliasBooksOwned(
    userId: string,
    aliases: CharacterInput["aliases"],
  ): Promise<void> {
    const bookIds = [
      ...new Set(
        aliases
          .map((alias) => alias.bookId)
          .filter((bookId): bookId is string => bookId !== null && bookId !== undefined),
      ),
    ];
    for (const bookId of bookIds) {
      await this.assertBookOwned(userId, bookId);
    }
  }

  private async assertBookOwned(userId: string, bookId: string): Promise<void> {
    const owned = await this.booksRepository.existsOwned({ bookId, userId });
    if (!owned) {
      throw new NotFoundError("Book not found", {
        code: CHARACTER_ERROR_CODES.bookNotFound,
      });
    }
  }

  private async assertMediaOwned(userId: string, mediaId: Nullable<string>): Promise<void> {
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

  private buildBookCharacterData({
    bookId,
    characterId,
    profile,
  }: {
    bookId: string;
    characterId: string;
    profile: BookCharacterProfileInput;
  }): CreateBookCharacterData {
    return {
      appearanceNotes: emptyToNull(profile.appearanceNotes),
      appearanceNotesIsSpoiler: profile.appearanceNotesIsSpoiler,
      attitude: profile.attitude ?? null,
      bookId,
      characterId,
      description: emptyToNull(profile.description),
      descriptionIsSpoiler: profile.descriptionIsSpoiler,
      displayName: emptyToNull(profile.displayName),
      displayNameIsSpoiler: profile.displayNameIsSpoiler,
      firstAppearanceAudioSeconds: profile.firstAppearanceAudioSeconds ?? null,
      firstAppearanceChapter: emptyToNull(profile.firstAppearanceChapter),
      firstAppearanceNote: emptyToNull(profile.firstAppearanceNote),
      firstAppearancePage: profile.firstAppearancePage ?? null,
      hidePresenceAsSpoiler: profile.hidePresenceAsSpoiler,
      importance: profile.importance,
      isPovCharacter: profile.isPovCharacter,
      narratorType: profile.narratorType ?? null,
      personalImpression: emptyToNull(profile.personalImpression),
      personalImpressionIsSpoiler: profile.personalImpressionIsSpoiler,
      portraitIsSpoiler: profile.portraitIsSpoiler,
      portraitMediaId: profile.portraitMediaId ?? null,
      roles: dedupeRoles(profile.roles).map((role) => ({
        customRole: emptyToNull(role.customRole),
        isSpoiler: role.isSpoiler,
        position: role.position ?? 0,
        roleType: role.roleType,
      })),
      sortOrder: profile.sortOrder ?? null,
      speciesOverride: emptyToNull(profile.speciesOverride),
      speciesOverrideIsSpoiler: profile.speciesOverrideIsSpoiler,
      status: profile.status,
      statusCustomText: emptyToNull(profile.statusCustomText),
      statusIsSpoiler: profile.statusIsSpoiler,
    };
  }

  private buildCharacterData(userId: string, input: CharacterInput): CreateCharacterData {
    return {
      aliases: dedupeAliases(
        input.aliases.map((alias) => ({
          bookId: alias.bookId ?? null,
          isSpoiler: alias.isSpoiler,
          name: alias.name,
          normalizedName: normalizeName(alias.name),
          position: alias.position ?? 0,
          type: alias.type,
        })),
      ),
      avatarMediaId: input.avatarMediaId ?? null,
      customGender: input.gender === "custom" ? emptyToNull(input.customGender) : null,
      entityKind: input.entityKind,
      gender: input.gender,
      globalAttitude: input.globalAttitude ?? null,
      isFavorite: input.isFavorite,
      name: input.name,
      neutralDescription: emptyToNull(input.neutralDescription),
      normalizedName: normalizeName(input.name),
      pronouns: emptyToNull(input.pronouns),
      species: emptyToNull(input.species),
      userId,
    };
  }

  private async insertBookCharacter({
    data,
    tx,
  }: {
    data: CreateBookCharacterData;
    tx: Prisma.TransactionClient;
  }): Promise<void> {
    try {
      await this.charactersRepository.createBookCharacter(data, tx);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictError("Character is already linked to this book", {
          code: CHARACTER_ERROR_CODES.alreadyLinkedToBook,
        });
      }
      throw error;
    }
  }

  private async loadDetails(
    args: { bookId?: string; characterId: string; userId: string },
    tx: Prisma.TransactionClient,
  ): Promise<CharacterDetailsRow> {
    const row = await this.charactersRepository.findOwnedCharacterDetails(args, tx);
    if (row === null) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }
    return row;
  }

  private mapAppearance(
    appearance: CharacterDetailsRow["bookAppearances"][number],
  ): BookCharacterView {
    return toBookCharacterView({
      appearance,
      portrait: this.mediaViewOf(appearance.portraitMedia),
    });
  }

  private mediaViewOf(asset: Nullable<MediaAssetModel>): Nullable<MediaView> {
    if (asset === null) {
      return null;
    }
    try {
      return this.mediaService.buildView(asset);
    } catch (error) {
      log.warn({ err: error, mediaId: asset.id }, "failed to build character media view");
      return null;
    }
  }

  private async resolveCharacterForBook({
    bookId,
    input,
    tx,
    userId,
  }: {
    bookId: string;
    input: CreateCharacterInBook;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<string> {
    if (input.mode === "new") {
      const characterData = this.buildCharacterData(userId, input.character);
      await this.assertMediaOwned(userId, characterData.avatarMediaId);
      await this.assertAliasBooksOwned(userId, input.character.aliases);
      const created = await this.charactersRepository.createCharacter(characterData, tx);
      return created.id;
    }

    const owned = await this.charactersRepository.findOwnedCharacterBare(
      { characterId: input.characterId, userId },
      tx,
    );
    if (owned === null) {
      throw new NotFoundError("Character not found", {
        code: CHARACTER_ERROR_CODES.ownershipMismatch,
      });
    }

    const alreadyLinked = await this.charactersRepository.existsLink(
      { bookId, characterId: input.characterId },
      tx,
    );
    if (alreadyLinked) {
      throw new ConflictError("Character is already linked to this book", {
        code: CHARACTER_ERROR_CODES.alreadyLinkedToBook,
      });
    }

    return input.characterId;
  }

  private toDetailsView(row: CharacterDetailsRow): CharacterDetailsView {
    return toCharacterDetailsView({
      appearances: row.bookAppearances.map((appearance) => this.mapAppearance(appearance)),
      avatar: this.mediaViewOf(row.avatarMedia),
      character: row,
    });
  }

  private toSummaryView(row: RosterRow): CharacterSummaryView {
    return toCharacterSummaryView({
      appearance: row,
      avatar: this.mediaViewOf(row.character.avatarMedia),
      character: row.character,
      portrait: this.mediaViewOf(row.portraitMedia),
    });
  }
}

function dedupeAliases(aliases: CreateAliasData[]): CreateAliasData[] {
  const seen = new Set<string>();
  return aliases.filter((alias) => {
    const key = `${alias.normalizedName}::${alias.type}::${alias.bookId ?? "global"}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeRoles(
  roles: BookCharacterProfileInput["roles"],
): BookCharacterProfileInput["roles"] {
  const seen = new Set<string>();
  return roles.filter((role) => {
    const key = `${role.roleType}::${normalizeName(role.customRole ?? "")}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
