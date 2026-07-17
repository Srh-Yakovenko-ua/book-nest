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
  UpdateBookCharacter,
  UpdateCharacter,
} from "@app/shared";

import { CHARACTER_ERROR_CODES, normalizeName, normalizeSearch } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { MediaAssetModel } from "../../../generated/prisma/models.js";
import type { CharacterDetailsRow, RosterRow } from "../infrastructure/characters.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ConflictError, NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { buildPaginator } from "../../../core/paginator.js";
import { isUniqueConstraintError } from "../../../core/prisma-errors.js";
import { BooksRepository } from "../../books/index.js";
import { MediaService } from "../../media/index.js";
import { TagsService } from "../../tags/index.js";
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
  type CreateRoleData,
  type UpdateBookCharacterData,
  type UpdateCharacterData,
} from "../infrastructure/characters.repository.js";

const log = createLogger("characters");

@Injectable()
export class CharactersService {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly booksRepository: BooksRepository,
    private readonly mediaService: MediaService,
    private readonly tagsService: TagsService,
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

  async unlink({
    bookId,
    characterId,
    userId,
  }: {
    bookId: string;
    characterId: string;
    userId: string;
  }): Promise<void> {
    await this.assertBookOwned(userId, bookId);

    await this.transactionRunner.run(async (tx) => {
      const bookCharacter = await this.charactersRepository.findOwnedBookCharacter(
        { bookId, characterId, userId },
        tx,
      );
      if (bookCharacter === null) {
        throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
      }
      await this.charactersRepository.deleteBookCharacter(
        { bookCharacterId: bookCharacter.id },
        tx,
      );
      await this.charactersRepository.replaceAliases({ aliases: [], bookId, characterId }, tx);
    });
  }

  async updateBook({
    bookId,
    characterId,
    input,
    userId,
  }: {
    bookId: string;
    characterId: string;
    input: UpdateBookCharacter;
    userId: string;
  }): Promise<CharacterDetailsView> {
    await this.assertBookOwned(userId, bookId);

    const detailsRow = await this.transactionRunner.run(async (tx) => {
      const bookCharacter = await this.charactersRepository.findOwnedBookCharacter(
        { bookId, characterId, userId },
        tx,
      );
      if (bookCharacter === null) {
        throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
      }

      if (input.portraitMediaId !== undefined) {
        await this.assertMediaOwned(userId, input.portraitMediaId ?? null);
      }
      if (input.tagIds !== undefined) {
        await this.assertTagsOwned({ tagIds: input.tagIds, userId }, tx);
      }

      await this.charactersRepository.updateBookCharacter(
        { bookCharacterId: bookCharacter.id, data: this.buildBookCharacterUpdateData(input) },
        tx,
      );

      if (input.roles !== undefined) {
        await this.charactersRepository.replaceRoles(
          { bookCharacterId: bookCharacter.id, roles: this.buildReplaceRoles(input.roles) },
          tx,
        );
      }
      if (input.aliases !== undefined) {
        await this.charactersRepository.replaceAliases(
          {
            aliases: this.buildReplaceAliases({ aliases: input.aliases, bookId }),
            bookId,
            characterId,
          },
          tx,
        );
      }
      if (input.tagIds !== undefined) {
        await this.charactersRepository.replaceCharacterTags(
          { characterId, tagIds: [...new Set(input.tagIds)] },
          tx,
        );
      }

      return this.loadDetails({ bookId, characterId, userId }, tx);
    });

    return this.toDetailsView(detailsRow);
  }

  async updateGlobal({
    characterId,
    input,
    userId,
  }: {
    characterId: string;
    input: UpdateCharacter;
    userId: string;
  }): Promise<CharacterDetailsView> {
    const detailsRow = await this.transactionRunner.run(async (tx) => {
      const owned = await this.charactersRepository.findOwnedCharacterBare(
        { characterId, userId },
        tx,
      );
      if (owned === null) {
        throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
      }

      if (input.avatarMediaId !== undefined) {
        await this.assertMediaOwned(userId, input.avatarMediaId ?? null);
      }

      await this.charactersRepository.updateCharacter(
        {
          characterId,
          data: this.buildCharacterUpdateData({ input, storedGender: owned.gender }),
          userId,
        },
        tx,
      );

      if (input.aliases !== undefined) {
        await this.charactersRepository.replaceAliases(
          {
            aliases: this.buildReplaceAliases({ aliases: input.aliases, bookId: null }),
            bookId: null,
            characterId,
          },
          tx,
        );
      }

      return this.loadDetails({ characterId, userId }, tx);
    });

    return this.toDetailsView(detailsRow);
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

  private async assertTagsOwned(
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

  private buildBookCharacterUpdateData(input: UpdateBookCharacter): UpdateBookCharacterData {
    const data: UpdateBookCharacterData = {};
    if (input.displayName !== undefined) {
      data.displayName = emptyToNull(input.displayName);
    }
    if (input.displayNameIsSpoiler !== undefined) {
      data.displayNameIsSpoiler = input.displayNameIsSpoiler;
    }
    if (input.importance !== undefined) {
      data.importance = input.importance;
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }
    if (input.statusCustomText !== undefined) {
      data.statusCustomText = emptyToNull(input.statusCustomText);
    }
    if (input.statusIsSpoiler !== undefined) {
      data.statusIsSpoiler = input.statusIsSpoiler;
    }
    if (input.description !== undefined) {
      data.description = emptyToNull(input.description);
    }
    if (input.descriptionIsSpoiler !== undefined) {
      data.descriptionIsSpoiler = input.descriptionIsSpoiler;
    }
    if (input.personalImpression !== undefined) {
      data.personalImpression = emptyToNull(input.personalImpression);
    }
    if (input.personalImpressionIsSpoiler !== undefined) {
      data.personalImpressionIsSpoiler = input.personalImpressionIsSpoiler;
    }
    if (input.appearanceNotes !== undefined) {
      data.appearanceNotes = emptyToNull(input.appearanceNotes);
    }
    if (input.appearanceNotesIsSpoiler !== undefined) {
      data.appearanceNotesIsSpoiler = input.appearanceNotesIsSpoiler;
    }
    if (input.speciesOverride !== undefined) {
      data.speciesOverride = emptyToNull(input.speciesOverride);
    }
    if (input.speciesOverrideIsSpoiler !== undefined) {
      data.speciesOverrideIsSpoiler = input.speciesOverrideIsSpoiler;
    }
    if (input.portraitMediaId !== undefined) {
      data.portraitMediaId = input.portraitMediaId ?? null;
    }
    if (input.portraitIsSpoiler !== undefined) {
      data.portraitIsSpoiler = input.portraitIsSpoiler;
    }
    if (input.attitude !== undefined) {
      data.attitude = input.attitude ?? null;
    }
    if (input.firstAppearanceChapter !== undefined) {
      data.firstAppearanceChapter = emptyToNull(input.firstAppearanceChapter);
    }
    if (input.firstAppearancePage !== undefined) {
      data.firstAppearancePage = input.firstAppearancePage ?? null;
    }
    if (input.firstAppearanceAudioSeconds !== undefined) {
      data.firstAppearanceAudioSeconds = input.firstAppearanceAudioSeconds ?? null;
    }
    if (input.firstAppearanceNote !== undefined) {
      data.firstAppearanceNote = emptyToNull(input.firstAppearanceNote);
    }
    if (input.isPovCharacter !== undefined) {
      data.isPovCharacter = input.isPovCharacter;
    }
    if (input.narratorType !== undefined) {
      data.narratorType = input.narratorType ?? null;
    }
    if (input.sortOrder !== undefined) {
      data.sortOrder = input.sortOrder ?? null;
    }
    if (input.hidePresenceAsSpoiler !== undefined) {
      data.hidePresenceAsSpoiler = input.hidePresenceAsSpoiler;
    }
    return data;
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

  private buildCharacterUpdateData({
    input,
    storedGender,
  }: {
    input: UpdateCharacter;
    storedGender: string;
  }): UpdateCharacterData {
    const data: UpdateCharacterData = {};
    if (input.name !== undefined) {
      data.name = input.name;
      data.normalizedName = normalizeName(input.name);
    }
    if (input.entityKind !== undefined) {
      data.entityKind = input.entityKind;
    }
    if (input.species !== undefined) {
      data.species = emptyToNull(input.species);
    }
    const effectiveGender = input.gender ?? storedGender;
    if (input.gender !== undefined) {
      data.gender = input.gender;
    }
    if (effectiveGender === "custom") {
      if (input.customGender !== undefined) {
        const customGender = emptyToNull(input.customGender);
        if (customGender === null) {
          throw new ValidationError("customGender is required when gender is custom", {
            code: CHARACTER_ERROR_CODES.validationFailed,
          });
        }
        data.customGender = customGender;
      }
    } else if (input.gender !== undefined || input.customGender !== undefined) {
      data.customGender = null;
    }
    if (input.pronouns !== undefined) {
      data.pronouns = emptyToNull(input.pronouns);
    }
    if (input.neutralDescription !== undefined) {
      data.neutralDescription = emptyToNull(input.neutralDescription);
    }
    if (input.avatarMediaId !== undefined) {
      data.avatarMediaId = input.avatarMediaId ?? null;
    }
    if (input.isFavorite !== undefined) {
      data.isFavorite = input.isFavorite;
    }
    if (input.globalAttitude !== undefined) {
      data.globalAttitude = input.globalAttitude ?? null;
    }
    return data;
  }

  private buildReplaceAliases({
    aliases,
    bookId,
  }: {
    aliases: NonNullable<UpdateCharacter["aliases"]>;
    bookId: Nullable<string>;
  }): CreateAliasData[] {
    return dedupeAliases(
      aliases.map((alias) => ({
        bookId,
        isSpoiler: alias.isSpoiler,
        name: alias.name,
        normalizedName: normalizeName(alias.name),
        position: alias.position ?? 0,
        type: alias.type,
      })),
    );
  }

  private buildReplaceRoles(roles: NonNullable<UpdateBookCharacter["roles"]>): CreateRoleData[] {
    return dedupeRoles(roles).map((role) => ({
      customRole: emptyToNull(role.customRole),
      isSpoiler: role.isSpoiler,
      position: role.position ?? 0,
      roleType: role.roleType,
    }));
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
