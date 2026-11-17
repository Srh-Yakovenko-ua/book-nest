import type { CharacterRelationshipDetailsView, UpsertRelationshipBookState } from "@app/shared";

import { CHARACTER_RELATIONSHIP_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildBookStateData } from "../domain/character-relationship-write.js";
import { toRelationshipDetailsView } from "../domain/character-relationship.mapper.js";
import { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";
import { RelationshipContextService } from "./relationship-context.service.js";

@Injectable()
export class RelationshipBookStateService {
  constructor(
    private readonly relationshipsRepository: CharacterRelationshipsRepository,
    private readonly accessAsserter: CharacterAccessAsserter,
    private readonly contextService: RelationshipContextService,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async removeBookState({
    bookId,
    relationshipId,
    userId,
  }: {
    bookId: string;
    relationshipId: string;
    userId: string;
  }): Promise<void> {
    await this.transactionRunner.run(async (tx) => {
      const relationship = await this.relationshipsRepository.findOwnedRelationshipBare(
        { relationshipId, userId },
        tx,
      );
      if (relationship === null) {
        throw new NotFoundError("Character relationship not found", {
          code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
        });
      }
      const deleted = await this.relationshipsRepository.deleteBookState(
        { bookId, relationshipId },
        tx,
      );
      if (deleted === 0) {
        throw new NotFoundError("Character relationship book state not found", {
          code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookStateNotFound,
        });
      }
    });
  }

  async upsertBookState({
    bookId,
    input,
    relationshipId,
    userId,
  }: {
    bookId: string;
    input: UpsertRelationshipBookState;
    relationshipId: string;
    userId: string;
  }): Promise<CharacterRelationshipDetailsView> {
    await this.accessAsserter.assertBookOwned({
      bookId,
      notFoundCode: CHARACTER_RELATIONSHIP_ERROR_CODES.bookNotFound,
      userId,
    });
    const row = await this.transactionRunner.run(async (tx) => {
      const relationship = await this.relationshipsRepository.findOwnedRelationshipBare(
        { relationshipId, userId },
        tx,
      );
      if (relationship === null) {
        throw new NotFoundError("Character relationship not found", {
          code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
        });
      }
      await this.relationshipsRepository.acquireBookStateLock({ bookId, relationshipId }, tx);
      const data = buildBookStateData(input);
      const updatedCount = await this.relationshipsRepository.updateBookState(
        { bookId, data, relationshipId },
        tx,
      );
      if (updatedCount === 0) {
        await this.accessAsserter.assertCharactersLinkedToBooks(
          {
            bookIds: [bookId],
            characterIds: [relationship.sourceCharacterId, relationship.targetCharacterId],
            invalidCode: CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid,
          },
          tx,
        );
        await this.relationshipsRepository.createBookState({ ...data, bookId, relationshipId }, tx);
      }
      return this.contextService.loadDetails({ relationshipId, userId }, tx);
    });

    return toRelationshipDetailsView({
      bookStates: row.bookStates,
      diagnostics: [],
      relationship: row,
    });
  }
}
