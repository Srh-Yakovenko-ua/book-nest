import type {
  BookCharacterRelationshipsQuery,
  CharacterRelationshipContextView,
  CharacterRelationshipDeletionResultView,
  CharacterRelationshipDetailsQuery,
  CharacterRelationshipDetailsView,
  CharacterRelationshipDiagnosticView,
  CreateCharacterRelationship,
  InitialRelationshipBookState,
  Nullable,
  RelationshipCategory,
  RelationshipDirectionality,
  RelationshipType,
  SeriesCharacterRelationshipsQuery,
  UpdateCharacterRelationship,
  UpsertRelationshipBookState,
} from "@app/shared";

import {
  CHARACTER_RELATIONSHIP_ERROR_CODES,
  getRelationshipTypeCategory,
  getRelationshipTypeDirectionality,
  normalizeName,
  RelationshipCategorySchema,
  RelationshipDirectionalitySchema,
  RelationshipTypeSchema,
} from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  RelationshipDetailsRow,
  UpdateBookStateData,
  UpdateRelationshipData,
} from "../infrastructure/character-relationships.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../../core/exceptions/errors.js";
import { BooksRepository } from "../../books/index.js";
import { emptyToNull } from "../domain/character-fields.js";
import {
  buildRelationshipLockKey,
  canonicalizeRelationshipEndpoints,
  detectFamilyDiagnostics,
} from "../domain/character-relationship-graph.js";
import {
  pickEffectiveBookState,
  toRelationshipBookStateView,
  toRelationshipDetailsView,
  toRelationshipView,
} from "../domain/character-relationship.mapper.js";
import { resolveAllowedBookIds } from "../domain/series-representative.js";
import { CharacterRelationshipsRepository } from "../infrastructure/character-relationships.repository.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";

type ResolvedContext = {
  allowedBookIds: string[];
  partNumberById: Map<string, Nullable<number>>;
};

@Injectable()
export class CharacterRelationshipsService {
  constructor(
    private readonly relationshipsRepository: CharacterRelationshipsRepository,
    private readonly charactersRepository: CharactersRepository,
    private readonly booksRepository: BooksRepository,
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
    const directionality = this.resolveDirectionality({
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
      await this.assertBookOwned({ bookId: state.bookId, userId });
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
      const row = await this.loadDetails({ relationshipId: relationship.id, userId }, tx);
      return { diagnostics, row };
    });

    return toRelationshipDetailsView({
      bookStates: result.row.bookStates,
      diagnostics: result.diagnostics,
      relationship: result.row,
    });
  }

  async getDetails({
    query,
    relationshipId,
    userId,
  }: {
    query: CharacterRelationshipDetailsQuery;
    relationshipId: string;
    userId: string;
  }): Promise<CharacterRelationshipDetailsView> {
    const row = await this.relationshipsRepository.findOwnedRelationshipDetails({
      relationshipId,
      userId,
    });
    if (row === null) {
      throw new NotFoundError("Character relationship not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
      });
    }
    if (query.contextBookId === undefined) {
      return toRelationshipDetailsView({
        bookStates: row.bookStates,
        diagnostics: [],
        relationship: row,
      });
    }
    const context = await this.resolveBookContext({ contextBookId: query.contextBookId, userId });
    const masked = this.maskDetailsForContext({ context, row });
    if (masked === null) {
      throw new NotFoundError("Character relationship not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
      });
    }
    return masked;
  }

  async listForBook({
    bookId,
    query,
    userId,
  }: {
    bookId: string;
    query: BookCharacterRelationshipsQuery;
    userId: string;
  }): Promise<CharacterRelationshipContextView[]> {
    await this.assertBookOwned({ bookId, userId });
    const rows = await this.relationshipsRepository.listRelationshipsInBooks({
      bookIds: [bookId],
      userId,
    });
    return this.buildContextViews({
      context: { allowedBookIds: [bookId], partNumberById: new Map([[bookId, null]]) },
      includeHistory: query.includeHistory ?? false,
      rows,
    });
  }

  async listForSeries({
    query,
    seriesId,
    userId,
  }: {
    query: SeriesCharacterRelationshipsQuery;
    seriesId: string;
    userId: string;
  }): Promise<CharacterRelationshipContextView[]> {
    await this.assertSeriesOwned({ seriesId, userId });
    const context = await this.resolveSeriesContext({
      contextBookId: query.contextBookId,
      seriesId,
      userId,
    });
    const rows = await this.relationshipsRepository.listRelationshipsInBooks({
      bookIds: context.allowedBookIds,
      userId,
    });
    return this.buildContextViews({ context, includeHistory: query.includeHistory ?? false, rows });
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
      } = this.buildUpdateData({ existing, input });

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
      const row = await this.loadDetails({ relationshipId, userId }, tx);
      return { diagnostics, row };
    });

    return toRelationshipDetailsView({
      bookStates: result.row.bookStates,
      diagnostics: result.diagnostics,
      relationship: result.row,
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
    await this.assertBookOwned({ bookId, userId });
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
      await this.relationshipsRepository.upsertBookState(
        { bookId, data: buildBookStateData(input), relationshipId },
        tx,
      );
      return this.loadDetails({ relationshipId, userId }, tx);
    });

    return toRelationshipDetailsView({
      bookStates: row.bookStates,
      diagnostics: [],
      relationship: row,
    });
  }

  private applyCustomUpdate({
    data,
    input,
    storedCategory,
  }: {
    data: UpdateRelationshipData;
    input: UpdateCharacterRelationship;
    storedCategory: RelationshipCategory;
  }): RelationshipCategory {
    if (input.category !== undefined && input.category !== "custom") {
      throw new BadRequestError("category must be custom when type is custom", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.validationFailed,
      });
    }
    if (input.type !== undefined || input.category !== undefined) {
      data.category = "custom";
    }
    if (input.customType !== undefined) {
      const customType = emptyToNull(input.customType);
      if (customType === null) {
        throw new BadRequestError("customType is required when type is custom", {
          code: CHARACTER_RELATIONSHIP_ERROR_CODES.validationFailed,
        });
      }
      data.customType = customType;
    } else if (input.type === "custom" && storedCategory !== "custom") {
      throw new BadRequestError("customType is required when type is custom", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.validationFailed,
      });
    }
    return "custom";
  }

  private async assertBookOwned({
    bookId,
    userId,
  }: {
    bookId: string;
    userId: string;
  }): Promise<void> {
    const owned = await this.booksRepository.existsOwned({ bookId, userId });
    if (!owned) {
      throw new NotFoundError("Book not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookNotFound,
      });
    }
  }

  private async assertCharactersOwned({
    characterIds,
    tx,
    userId,
  }: {
    characterIds: string[];
    tx: Prisma.TransactionClient;
    userId: string;
  }): Promise<void> {
    const uniqueIds = [...new Set(characterIds)];
    const owned = await this.relationshipsRepository.countOwnedCharacters(
      { characterIds: uniqueIds, userId },
      tx,
    );
    if (owned !== uniqueIds.length) {
      throw new NotFoundError("Character not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.characterNotFound,
      });
    }
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

  private async assertSeriesOwned({
    seriesId,
    userId,
  }: {
    seriesId: string;
    userId: string;
  }): Promise<void> {
    const owns = await this.charactersRepository.existsOwnedSeries({ seriesId, userId });
    if (!owns) {
      throw new NotFoundError("Series not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid,
      });
    }
  }

  private buildContextViews({
    context,
    includeHistory,
    rows,
  }: {
    context: ResolvedContext;
    includeHistory: boolean;
    rows: RelationshipDetailsRow[];
  }): CharacterRelationshipContextView[] {
    const views: CharacterRelationshipContextView[] = [];
    for (const row of rows) {
      const effective = pickEffectiveBookState({
        partNumberById: context.partNumberById,
        states: row.bookStates,
      });
      if (effective !== null && effective.hideRelationshipAsSpoiler) {
        continue;
      }
      const typeHidden = effective?.isTypeSpoiler ?? false;
      const visibleStates = row.bookStates.filter((state) => !state.hideRelationshipAsSpoiler);
      views.push({
        effectiveState:
          effective === null
            ? null
            : toRelationshipBookStateView({
                descriptionHidden: effective.isDescriptionSpoiler,
                state: effective,
              }),
        history: includeHistory
          ? visibleStates.map((state) =>
              toRelationshipBookStateView({
                descriptionHidden: state.isDescriptionSpoiler,
                state,
              }),
            )
          : [],
        relationship: toRelationshipView({ relationship: row, typeHidden }),
      });
    }
    return views;
  }

  private buildUpdateData({
    existing,
    input,
  }: {
    existing: {
      category: string;
      customType: Nullable<string>;
      directionality: string;
      type: string;
    };
    input: UpdateCharacterRelationship;
  }): {
    data: UpdateRelationshipData;
    effectiveCategory: RelationshipCategory;
    effectiveCustomType: Nullable<string>;
    effectiveDirectionality: RelationshipDirectionality;
    effectiveType: RelationshipType;
  } {
    const storedType = RelationshipTypeSchema.parse(existing.type);
    const storedCategory = RelationshipCategorySchema.parse(existing.category);
    const effectiveType = input.type ?? storedType;
    const data: UpdateRelationshipData = {};

    if (input.type !== undefined) {
      data.type = input.type;
    }
    if (input.sourceLabel !== undefined) {
      data.sourceLabel = emptyToNull(input.sourceLabel);
    }
    if (input.targetLabel !== undefined) {
      data.targetLabel = emptyToNull(input.targetLabel);
    }
    if (input.isCanonical !== undefined) {
      data.isCanonical = input.isCanonical;
    }

    if (effectiveType === "custom") {
      const effectiveCategory = this.applyCustomUpdate({ data, input, storedCategory });
      return {
        data,
        effectiveCategory,
        effectiveCustomType:
          input.customType === undefined ? existing.customType : emptyToNull(input.customType),
        effectiveDirectionality: RelationshipDirectionalitySchema.parse(existing.directionality),
        effectiveType,
      };
    }

    const catalogCategory = getRelationshipTypeCategory(effectiveType);
    if (input.category !== undefined && input.category !== catalogCategory) {
      throw new BadRequestError("type does not belong to the given category", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.validationFailed,
      });
    }
    const catalogDirectionality = getRelationshipTypeDirectionality(effectiveType);
    data.directionality = catalogDirectionality;
    if (input.type !== undefined || input.category !== undefined) {
      data.category = catalogCategory;
    }
    if (input.type !== undefined) {
      data.customType = null;
    }
    return {
      data,
      effectiveCategory: catalogCategory,
      effectiveCustomType: null,
      effectiveDirectionality: catalogDirectionality,
      effectiveType,
    };
  }

  private async loadDetails(
    { relationshipId, userId }: { relationshipId: string; userId: string },
    tx: Prisma.TransactionClient,
  ): Promise<RelationshipDetailsRow> {
    const row = await this.relationshipsRepository.findOwnedRelationshipDetails(
      { relationshipId, userId },
      tx,
    );
    if (row === null) {
      throw new NotFoundError("Character relationship not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.notFound,
      });
    }
    return row;
  }

  private maskDetailsForContext({
    context,
    row,
  }: {
    context: ResolvedContext;
    row: RelationshipDetailsRow;
  }): Nullable<CharacterRelationshipDetailsView> {
    const allowed = new Set(context.allowedBookIds);
    const allowedStates = row.bookStates.filter((state) => allowed.has(state.bookId));
    const effective = pickEffectiveBookState({
      partNumberById: context.partNumberById,
      states: allowedStates,
    });
    if (effective !== null && effective.hideRelationshipAsSpoiler) {
      return null;
    }
    const typeHidden = effective?.isTypeSpoiler ?? false;
    const visibleStates = allowedStates.filter((state) => !state.hideRelationshipAsSpoiler);
    return {
      ...toRelationshipView({ relationship: row, typeHidden }),
      bookStates: visibleStates.map((state) =>
        toRelationshipBookStateView({ descriptionHidden: state.isDescriptionSpoiler, state }),
      ),
      diagnostics: [],
    };
  }

  private async resolveBookContext({
    contextBookId,
    userId,
  }: {
    contextBookId: string;
    userId: string;
  }): Promise<ResolvedContext> {
    const contextBook = await this.charactersRepository.findOwnedBookContext({
      bookId: contextBookId,
      userId,
    });
    if (contextBook === null) {
      throw new NotFoundError("Book not found", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookNotFound,
      });
    }
    if (contextBook.seriesId === null) {
      return {
        allowedBookIds: [contextBook.id],
        partNumberById: new Map([[contextBook.id, contextBook.partNumber]]),
      };
    }
    const seriesBooks = await this.charactersRepository.listSeriesBooks({
      seriesId: contextBook.seriesId,
      userId,
    });
    return {
      allowedBookIds: resolveAllowedBookIds({ contextBook, includeFuture: false, seriesBooks }),
      partNumberById: new Map(seriesBooks.map((book) => [book.id, book.partNumber])),
    };
  }

  private resolveDirectionality({
    directionality,
    type,
  }: {
    directionality: RelationshipDirectionality;
    type: RelationshipType;
  }): RelationshipDirectionality {
    if (type === "custom") {
      return directionality;
    }
    const expected = getRelationshipTypeDirectionality(type);
    if (directionality !== expected) {
      throw new BadRequestError("directionality does not match the relationship type", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.directionMismatch,
      });
    }
    return expected;
  }

  private async resolveSeriesContext({
    contextBookId,
    seriesId,
    userId,
  }: {
    contextBookId: string | undefined;
    seriesId: string;
    userId: string;
  }): Promise<ResolvedContext> {
    const seriesBooks = await this.charactersRepository.listSeriesBooks({ seriesId, userId });
    const partNumberById = new Map(seriesBooks.map((book) => [book.id, book.partNumber]));
    if (contextBookId === undefined) {
      return { allowedBookIds: seriesBooks.map((book) => book.id), partNumberById };
    }
    const contextBook = seriesBooks.find((book) => book.id === contextBookId);
    if (contextBook === undefined) {
      throw new BadRequestError("The context book does not belong to this series", {
        code: CHARACTER_RELATIONSHIP_ERROR_CODES.bookContextInvalid,
      });
    }
    return {
      allowedBookIds: resolveAllowedBookIds({ contextBook, includeFuture: false, seriesBooks }),
      partNumberById,
    };
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

function buildBookStateData(
  input: InitialRelationshipBookState | UpsertRelationshipBookState,
): UpdateBookStateData {
  return {
    description: emptyToNull(input.description),
    endedAudioSeconds: input.endedAudioSeconds ?? null,
    endedChapter: emptyToNull(input.endedChapter),
    endedPage: input.endedPage ?? null,
    hideRelationshipAsSpoiler: input.hideRelationshipAsSpoiler,
    intensity: input.intensity ?? null,
    introducedAudioSeconds: input.introducedAudioSeconds ?? null,
    introducedChapter: emptyToNull(input.introducedChapter),
    introducedPage: input.introducedPage ?? null,
    isDescriptionSpoiler: input.isDescriptionSpoiler,
    isTypeSpoiler: input.isTypeSpoiler,
    status: input.status,
  };
}

function dedupeBookStates(states: InitialRelationshipBookState[]): InitialRelationshipBookState[] {
  const seen = new Set<string>();
  return states.filter((state) => {
    if (seen.has(state.bookId)) {
      return false;
    }
    seen.add(state.bookId);
    return true;
  });
}
