import type {
  CharacterRelationshipDeletionResultView,
  CharacterRelationshipDetailsView,
  CharacterRelationshipDiagnosticView,
  CreateCharacterRelationship,
  Nullable,
  RelationshipCategory,
  RelationshipType,
  UpdateCharacterRelationship,
} from "@app/shared";

import {
  CHARACTER_RELATIONSHIP_ERROR_CODES,
  normalizeName,
  RelationshipTypeSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { emptyToNull } from "../domain/character-fields.js";
import {
  buildRelationshipLockKey,
  canonicalizeRelationshipEndpoints,
  detectFamilyDiagnostics,
} from "../domain/character-relationship-graph.js";
import {
  buildBookStateData,
  buildUpdateData,
  dedupeBookStates,
  resolveDirectionality,
} from "../domain/character-relationship-write.js";
import { toRelationshipDetailsView } from "../domain/character-relationship.mapper.js";
import { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import { CharacterAccessAsserter } from "./character-access.asserter.js";
import { RelationshipContextService } from "./relationship-context.service.js";

@Injectable()
export class CharacterRelationshipsService {
  constructor(
    private readonly relationshipsRepository: CharacterRelationshipsRepository,
    private readonly accessAsserter: CharacterAccessAsserter,
    private readonly contextService: RelationshipContextService,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async create({
    input,
    userId,
  }: {
    input: CreateCharacterRelationship;
    userId: string;
  }): Promise<CharacterRelationshipDetailsView> {
    if (input.sourceCharacterId === input.targetCharacterId) {
      throw new BadRequestError("A relationship cannot connect a character to itself", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.selfReference,
      });
    }
    const directionality = resolveDirectionality({
      directionality: input.directionality,
      type: input.type,
    });
    const canonical = canonicalizeRelationshipEndpoints({
      directionality,
      sourceCharacterId: input.sourceCharacterId,
      sourceLabel: emptyToNull(input.sourceLabel),
      targetCharacterId: input.targetCharacterId,
      targetLabel: emptyToNull(input.targetLabel),
    });
    const customType = input.type === "custom" ? emptyToNull(input.customType) : null;
    const bookStates = dedupeBookStates(input.initialBookStates);
    for (const state of bookStates) {
      await this.accessAsserter.assertBookOwned({
        bookId: state.bookId,
        notFoundCode: CHARACTER_RELATIONSHIP_ERROR_CODES.bookNotFound,
        userId,
      });
    }

    const result = await this.transactionRunner.run(async (tx) => {
      await this.assertCharactersOwned({
        characterIds: [canonical.sourceCharacterId, canonical.targetCharacterId],
        tx,
        userId,
      });
      await this.relationshipsRepository.acquireRelationshipLock(
        {
          key: buildRelationshipLockKey({
            directionality,
            normalizedCustomType: customType === null ? null : normalizeName(customType),
            sourceCharacterId: canonical.sourceCharacterId,
            targetCharacterId: canonical.targetCharacterId,
            type: input.type,
            userId,
          }),
        },
        tx,
      );
      await this.assertNoDuplicate({
        customType,
        sourceCharacterId: canonical.sourceCharacterId,
        targetCharacterId: canonical.targetCharacterId,
        tx,
        type: input.type,
        userId,
      });
      const diagnostics = await this.runFamilyDiagnostics({
        allowFamilyCycle: input.allowFamilyCycle,
        candidate: {
          sourceCharacterId: canonical.sourceCharacterId,
          targetCharacterId: canonical.targetCharacterId,
          type: input.type,
        },
        category: input.category,
        tx,
        userId,
      });

      const relationship = await this.relationshipsRepository.createRelationship(
        {
          category: input.category,
          customType,
          directionality,
          isCanonical: input.isCanonical,
          sourceCharacterId: canonical.sourceCharacterId,
          sourceLabel: canonical.sourceLabel,
          targetCharacterId: canonical.targetCharacterId,
          targetLabel: canonical.targetLabel,
          type: input.type,
          userId,
        },
        tx,
      );
      await this.relationshipsRepository.createBookStates(
        bookStates.map((state) => ({
          ...buildBookStateData(state),
          bookId: state.bookId,
          relationshipId: relationship.id,
        })),
        tx,
      );
      const row = await this.contextService.loadDetails(
        { relationshipId: relationship.id, userId },
        tx,
      );
      return { diagnostics, row };
    });

    return toRelationshipDetailsView({
      bookStates: result.row.bookStates,
      diagnostics: result.diagnostics,
      relationship: result.row,
    });
  }

  async remove({
    relationshipId,
    userId,
  }: {
    relationshipId: string;
    userId: string;
  }): Promise<CharacterRelationshipDeletionResultView> {
    return this.transactionRunner.run(async (tx) => {
      const relationship = await this.relationshipsRepository.findOwnedRelationshipBare(
        { relationshipId, userId },
        tx,
      );
      if (relationship === null) {
        throw new NotFoundError("Character relationship not found", {
          code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
        });
      }
      const bookStateCount = await this.relationshipsRepository.countBookStates(
        { relationshipId },
        tx,
      );
      await this.relationshipsRepository.deleteOwnedRelationship({ relationshipId, userId }, tx);
      return { bookStateCount, id: relationshipId };
    });
  }

  async update({
    input,
    relationshipId,
    userId,
  }: {
    input: UpdateCharacterRelationship;
    relationshipId: string;
    userId: string;
  }): Promise<CharacterRelationshipDetailsView> {
    const result = await this.transactionRunner.run(async (tx) => {
      const existing = await this.relationshipsRepository.findOwnedRelationshipBare(
        { relationshipId, userId },
        tx,
      );
      if (existing === null) {
        throw new NotFoundError("Character relationship not found", {
          code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
        });
      }
      const {
        data,
        effectiveCategory,
        effectiveCustomType,
        effectiveDirectionality,
        effectiveType,
      } = buildUpdateData({ existing, input });

      const canonical = canonicalizeRelationshipEndpoints({
        directionality: effectiveDirectionality,
        sourceCharacterId: existing.sourceCharacterId,
        sourceLabel:
          input.sourceLabel === undefined ? existing.sourceLabel : emptyToNull(input.sourceLabel),
        targetCharacterId: existing.targetCharacterId,
        targetLabel:
          input.targetLabel === undefined ? existing.targetLabel : emptyToNull(input.targetLabel),
      });
      const effectiveNormalizedCustomType =
        effectiveCustomType === null ? null : normalizeName(effectiveCustomType);
      const storedNormalizedCustomType =
        existing.customType === null ? null : normalizeName(existing.customType);
      const identityChanged =
        effectiveType !== existing.type ||
        effectiveDirectionality !== existing.directionality ||
        effectiveNormalizedCustomType !== storedNormalizedCustomType;

      if (identityChanged) {
        if (canonical.sourceCharacterId !== existing.sourceCharacterId) {
          data.sourceCharacterId = canonical.sourceCharacterId;
          data.sourceLabel = canonical.sourceLabel;
          data.targetCharacterId = canonical.targetCharacterId;
          data.targetLabel = canonical.targetLabel;
        }
        await this.relationshipsRepository.acquireRelationshipLock(
          {
            key: buildRelationshipLockKey({
              directionality: effectiveDirectionality,
              normalizedCustomType: effectiveNormalizedCustomType,
              sourceCharacterId: canonical.sourceCharacterId,
              targetCharacterId: canonical.targetCharacterId,
              type: effectiveType,
              userId,
            }),
          },
          tx,
        );
        await this.assertNoDuplicate({
          customType: effectiveCustomType,
          excludeRelationshipId: relationshipId,
          sourceCharacterId: canonical.sourceCharacterId,
          targetCharacterId: canonical.targetCharacterId,
          tx,
          type: effectiveType,
          userId,
        });
      }

      const diagnostics =
        effectiveType === existing.type && effectiveCategory === existing.category
          ? []
          : await this.runFamilyDiagnostics({
              allowFamilyCycle: input.allowFamilyCycle,
              candidate: {
                sourceCharacterId: canonical.sourceCharacterId,
                targetCharacterId: canonical.targetCharacterId,
                type: effectiveType,
              },
              category: effectiveCategory,
              excludeRelationshipId: relationshipId,
              tx,
              userId,
            });
      await this.relationshipsRepository.updateRelationship({ data, relationshipId, userId }, tx);
      const row = await this.contextService.loadDetails({ relationshipId, userId }, tx);
      return { diagnostics, row };
    });

    return toRelationshipDetailsView({
      bookStates: result.row.bookStates,
      diagnostics: result.diagnostics,
      relationship: result.row,
    });
  }

  private assertCharactersOwned({
    characterIds,
    tx,
    userId,
  }: {
    characterIds: string[];
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<void> {
    return this.accessAsserter.assertCharactersOwned(
      {
        characterIds,
        notFoundCode: CHARACTER_RELATIONSHIP_ERROR_CODES.characterNotFound,
        userId,
      },
      tx,
    );
  }

  private async assertNoDuplicate({
    customType,
    excludeRelationshipId,
    sourceCharacterId,
    targetCharacterId,
    tx,
    type,
    userId,
  }: {
    customType: Nullable<string>;
    excludeRelationshipId?: string;
    sourceCharacterId: string;
    targetCharacterId: string;
    tx: Prisma.TransactionClient;
    type: RelationshipType;
    userId: string;
  }): Promise<void> {
    const candidates = await this.relationshipsRepository.findDuplicateCandidates(
      { sourceCharacterId, targetCharacterId, type, userId },
      tx,
    );
    const normalizedCustomType = customType === null ? null : normalizeName(customType);
    const hasDuplicate = candidates.some((candidate) => {
      if (candidate.id === excludeRelationshipId) {
        return false;
      }
      if (type !== "custom") {
        return true;
      }
      return normalizeName(candidate.customType ?? "") === (normalizedCustomType ?? "");
    });
    if (hasDuplicate) {
      throw new ConflictError("This relationship already exists", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.duplicate,
      });
    }
  }

  private async runFamilyDiagnostics({
    allowFamilyCycle,
    candidate,
    category,
    excludeRelationshipId,
    tx,
    userId,
  }: {
    allowFamilyCycle: boolean;
    candidate: { sourceCharacterId: string; targetCharacterId: string; type: RelationshipType };
    category: RelationshipCategory;
    excludeRelationshipId?: string;
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<CharacterRelationshipDiagnosticView[]> {
    if (category !== "family") {
      return [];
    }
    const existingEdges = await this.relationshipsRepository.findFamilyAncestryEdges(
      { excludeRelationshipId, userId },
      tx,
    );
    const diagnostics = detectFamilyDiagnostics({
      candidate,
      existingEdges: existingEdges.map((edge) => ({
        sourceCharacterId: edge.sourceCharacterId,
        targetCharacterId: edge.targetCharacterId,
        type: RelationshipTypeSchema.parse(edge.type),
      })),
    });
    const conflict = diagnostics.find((diagnostic) => diagnostic.severity === "conflict");
    if (conflict !== undefined) {
      throw new ConflictError(conflict.message, {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected,
      });
    }
    const warning = diagnostics.find((diagnostic) => diagnostic.severity === "warning");
    if (warning !== undefined && !allowFamilyCycle) {
      throw new ConflictError(warning.message, {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.familyCycleDetected,
      });
    }
    return diagnostics.filter((diagnostic) => diagnostic.severity === "warning");
  }
}
