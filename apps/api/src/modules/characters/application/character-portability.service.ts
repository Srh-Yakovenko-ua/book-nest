import type { CharacterBundle, CharacterExportQuery, CharacterImportResultView } from "@app/shared";

import { CHARACTER_IMPORT_ERROR_CODES, CharacterBundleSchema } from "@app/shared";
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { OwnedLibraryRefs } from "../domain/character-portability.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { ValidationError } from "../../../core/exceptions/errors.js";
import {
  classifyBundleParseError,
  planCharacterImport,
  serializeCharacterBundle,
} from "../domain/character-portability.js";
import { CharacterPortabilityRepository } from "../infrastructure/character-portability.repository.js";

@Injectable()
export class CharacterPortabilityService {
  constructor(
    private readonly portabilityRepository: CharacterPortabilityRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async export({
    query,
    userId,
  }: {
    query: CharacterExportQuery;
    userId: string;
  }): Promise<CharacterBundle> {
    const includeArchived = query.includeArchived;
    const [characters, groups, relationships, theories] = await Promise.all([
      this.portabilityRepository.loadCharacters({ includeArchived, userId }),
      this.portabilityRepository.loadGroups({ includeArchived, userId }),
      this.portabilityRepository.loadRelationships({ includeArchived, userId }),
      this.portabilityRepository.loadTheories({ includeArchived, userId }),
    ]);
    return serializeCharacterBundle({
      exportedAt: new Date(),
      source: { characters, groups, relationships, theories },
    });
  }

  async import({
    payload,
    userId,
  }: {
    payload: unknown;
    userId: string;
  }): Promise<CharacterImportResultView> {
    const bundle = this.parseBundle(payload);
    const owned = await this.resolveOwnedRefs({ bundle, userId });
    const plan = planCharacterImport({
      bundle,
      newId: randomUUID,
      now: new Date(),
      owned,
      userId,
    });
    await this.transactionRunner.run((tx) => this.portabilityRepository.insertGraph(plan, tx));
    return { created: plan.created, formatVersion: bundle.formatVersion, skipped: plan.skipped };
  }

  private parseBundle(payload: unknown): CharacterBundle {
    const result = CharacterBundleSchema.safeParse(payload);
    if (result.success) {
      return result.data;
    }
    if (classifyBundleParseError(result.error) === "tooLarge") {
      throw new ValidationError("The character bundle exceeds the maximum allowed size", {
        code: CHARACTER_IMPORT_ERROR_CODES.tooLarge,
      });
    }
    throw new ValidationError("The character bundle is not a valid export", {
      code: CHARACTER_IMPORT_ERROR_CODES.invalid,
    });
  }

  private async resolveOwnedRefs({
    bundle,
    userId,
  }: {
    bundle: CharacterBundle;
    userId: string;
  }): Promise<OwnedLibraryRefs> {
    const bookIds = new Set<string>();
    const mediaIds = new Set<string>();
    const seriesIds = new Set<string>();
    const tagIds = new Set<string>();

    for (const character of bundle.characters) {
      if (character.avatarMediaId !== null) {
        mediaIds.add(character.avatarMediaId);
      }
      for (const alias of character.aliases) {
        if (alias.bookId !== null) {
          bookIds.add(alias.bookId);
        }
      }
      for (const tagId of character.tagIds) {
        tagIds.add(tagId);
      }
      for (const appearance of character.appearances) {
        bookIds.add(appearance.bookId);
        if (appearance.portraitMediaId !== null) {
          mediaIds.add(appearance.portraitMediaId);
        }
      }
    }
    for (const group of bundle.groups) {
      if (group.seriesId !== null) {
        seriesIds.add(group.seriesId);
      }
      for (const membership of group.memberships) {
        if (membership.bookId !== null) {
          bookIds.add(membership.bookId);
        }
      }
    }
    for (const relationship of bundle.relationships) {
      for (const bookState of relationship.bookStates) {
        bookIds.add(bookState.bookId);
      }
    }
    for (const theory of bundle.theories) {
      if (theory.bookId !== null) {
        bookIds.add(theory.bookId);
      }
      if (theory.seriesId !== null) {
        seriesIds.add(theory.seriesId);
      }
    }

    const [ownedBookIds, ownedMediaIds, ownedSeriesIds, ownedTagIds] = await Promise.all([
      this.portabilityRepository.findOwnedBookIds({ bookIds: [...bookIds], userId }),
      this.portabilityRepository.findOwnedMediaIds({ mediaIds: [...mediaIds], userId }),
      this.portabilityRepository.findOwnedSeriesIds({ seriesIds: [...seriesIds], userId }),
      this.portabilityRepository.findOwnedTagIds({ tagIds: [...tagIds], userId }),
    ]);

    return {
      bookIds: ownedBookIds,
      mediaIds: ownedMediaIds,
      seriesIds: ownedSeriesIds,
      tagIds: ownedTagIds,
    };
  }
}
