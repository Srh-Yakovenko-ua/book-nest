import type {
  CharacterDeletionPreview,
  CharacterDeletionResult,
  CharacterDetailsView,
} from "@app/shared";
import type { Queue } from "bullmq";

import { CHARACTER_ERROR_CODES } from "@app/shared";
import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";

import { NotFoundError } from "../../../core/exceptions/errors.js";
import { createLogger } from "../../../core/logger.js";
import { TRASH_RETENTION } from "../../../core/trash-retention.js";
import { MediaService } from "../../media/index.js";
import {
  CHARACTER_PURGE_JOB,
  CHARACTER_PURGE_QUEUE_NAME,
  type CharacterPurgeJob,
  collectMediaIds,
} from "../domain/character-purge.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";
import { CharacterDetailsAssembler } from "./character-details.assembler.js";

const log = createLogger("characters");

@Injectable()
export class CharacterLifecycleService {
  constructor(
    private readonly charactersRepository: CharactersRepository,
    private readonly mediaService: MediaService,
    private readonly detailsAssembler: CharacterDetailsAssembler,
    @InjectQueue(CHARACTER_PURGE_QUEUE_NAME)
    private readonly purgeQueue: Queue<CharacterPurgeJob>,
  ) {}

  async deletionPreview({
    characterId,
    userId,
  }: {
    characterId: string;
    userId: string;
  }): Promise<CharacterDeletionPreview> {
    const owned = await this.charactersRepository.findOwnedCharacterBare({ characterId, userId });
    if (owned === null) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }
    return this.charactersRepository.countDeletionImpact({ characterId });
  }

  async purge({ characterId, userId }: CharacterPurgeJob): Promise<void> {
    const character = await this.charactersRepository.findForPurge({ characterId, userId });
    if (character === null || character.deletedAt === null) {
      return;
    }

    const deletedBefore = TRASH_RETENTION.purgeThreshold(new Date());
    const mediaIds = collectMediaIds(character);
    const purged = await this.charactersRepository.hardDeleteIfDeleted({
      characterId,
      deletedBefore,
      userId,
    });
    if (purged === 0) {
      return;
    }

    for (const mediaId of mediaIds) {
      try {
        await this.mediaService.deleteIfUnreferenced({ id: mediaId, userId });
      } catch (error) {
        log.warn({ err: error, mediaId }, "failed to clean up orphaned character media");
      }
    }
  }

  async restore({
    characterId,
    userId,
  }: {
    characterId: string;
    userId: string;
  }): Promise<CharacterDetailsView> {
    const restored = await this.charactersRepository.restore({ characterId, userId });
    if (restored === 0) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }
    await this.cancelPurge(characterId);
    return this.detailsAssembler.loadFullCharacterDetails({
      characterId,
      revealHiddenProfile: true,
      userId,
    });
  }

  async softDelete({
    characterId,
    userId,
  }: {
    characterId: string;
    userId: string;
  }): Promise<CharacterDeletionResult> {
    const deletedAt = new Date();
    const affected = await this.charactersRepository.softDelete({ characterId, deletedAt, userId });
    if (affected === 0) {
      throw new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
    }
    await this.enqueuePurge({ characterId, userId });
    return {
      characterId,
      deletedAt: deletedAt.toISOString(),
      purgeAt: TRASH_RETENTION.purgeAfter(deletedAt).toISOString(),
    };
  }

  private async cancelPurge(characterId: string): Promise<void> {
    try {
      await this.purgeQueue.remove(characterId);
    } catch (error) {
      log.warn({ characterId, err: error }, "failed to cancel character purge job");
    }
  }

  private async enqueuePurge({ characterId, userId }: CharacterPurgeJob): Promise<void> {
    try {
      await this.purgeQueue.remove(characterId);
      await this.purgeQueue.add(
        CHARACTER_PURGE_JOB,
        { characterId, userId },
        { delay: TRASH_RETENTION.purgeDelayMs, jobId: characterId },
      );
    } catch (error) {
      log.warn({ characterId, err: error }, "failed to enqueue character purge job");
    }
  }
}
