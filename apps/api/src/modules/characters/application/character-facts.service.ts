import type {
  CharacterFactsQuery,
  CharacterFactView,
  CreateCharacterFactInput,
  Paginator,
  UpdateCharacterFactInput,
} from "@app/shared";

import { CHARACTER_ERROR_CODES, CHARACTER_FACT_ERROR_CODES } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  ActiveAppearanceRow,
  CharacterFactPatch,
} from "../infrastructure/character-facts.repository.js";

import {
  HEAVY_TRANSACTION_OPTIONS,
  TransactionRunner,
} from "../../../core/database/transaction-runner.js";
import { NotFoundError } from "../../../core/exceptions/errors.js";
import { buildPaginator, pageSlice } from "../../../core/paginator.js";
import { isForeignKeyConstraintError, isRecordNotFoundError } from "../../../core/prisma-errors.js";
import { assertFactPageWithinBook, toCharacterFactView } from "../domain/character-fact.js";
import { CharacterFactsRepository } from "../infrastructure/character-facts.repository.js";

type AppearanceScope = {
  bookId: string;
  characterId: string;
  userId: string;
};

@Injectable()
export class CharacterFactsService {
  constructor(
    private readonly characterFactsRepository: CharacterFactsRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  create({
    input,
    ...scope
  }: AppearanceScope & { input: CreateCharacterFactInput }): Promise<CharacterFactView> {
    return this.transactionRunner.run(async (tx) => {
      const appearance = await this.lockActiveAppearance({ scope, tx });
      const page = input.page ?? null;
      assertFactPageWithinBook({ page, pagesCount: appearance.pagesCount });
      try {
        const created = await this.characterFactsRepository.createFact(
          {
            bookCharacterId: appearance.bookCharacterId,
            data: { chapter: input.chapter ?? null, page, text: input.text, title: input.title },
          },
          tx,
        );
        return toCharacterFactView(created);
      } catch (error) {
        if (isForeignKeyConstraintError(error)) {
          throw characterNotFoundError();
        }
        throw error;
      }
    }, HEAVY_TRANSACTION_OPTIONS);
  }

  async list({
    query,
    ...scope
  }: AppearanceScope & { query: CharacterFactsQuery }): Promise<Paginator<CharacterFactView>> {
    const appearance = await this.resolveActiveAppearance({ scope });
    const listScope = { bookCharacterId: appearance.bookCharacterId, search: query.q };
    const [facts, totalCount] = await Promise.all([
      this.characterFactsRepository.listFacts({
        scope: listScope,
        ...pageSlice({ pageNumber: query.pageNumber, pageSize: query.pageSize }),
      }),
      this.characterFactsRepository.countFacts(listScope),
    ]);
    return buildPaginator({
      items: facts.map((fact) => toCharacterFactView(fact)),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async remove({ factId, ...scope }: AppearanceScope & { factId: string }): Promise<void> {
    await this.transactionRunner.run(async (tx) => {
      const appearance = await this.lockActiveAppearance({ scope, tx });
      const deletedCount = await this.characterFactsRepository.deleteFact(
        { bookCharacterId: appearance.bookCharacterId, factId },
        tx,
      );
      if (deletedCount === 0) {
        throw factNotFoundError();
      }
    }, HEAVY_TRANSACTION_OPTIONS);
  }

  update({
    factId,
    input,
    ...scope
  }: AppearanceScope & {
    factId: string;
    input: UpdateCharacterFactInput;
  }): Promise<CharacterFactView> {
    return this.transactionRunner.run(async (tx) => {
      const appearance = await this.lockActiveAppearance({ scope, tx });
      assertFactPageWithinBook({ page: input.page ?? null, pagesCount: appearance.pagesCount });
      try {
        const updated = await this.characterFactsRepository.updateFact(
          { bookCharacterId: appearance.bookCharacterId, data: toFactPatch(input), factId },
          tx,
        );
        return toCharacterFactView(updated);
      } catch (error) {
        if (isRecordNotFoundError(error)) {
          throw factNotFoundError();
        }
        throw error;
      }
    }, HEAVY_TRANSACTION_OPTIONS);
  }

  private async lockActiveAppearance({
    scope,
    tx,
  }: {
    scope: AppearanceScope;
    tx: Prisma.TransactionClient;
  }): Promise<ActiveAppearanceRow> {
    await this.characterFactsRepository.acquireMergeGuard({ userId: scope.userId }, tx);
    return this.resolveActiveAppearance({ scope, tx });
  }

  private async resolveActiveAppearance({
    scope,
    tx,
  }: {
    scope: AppearanceScope;
    tx?: Prisma.TransactionClient;
  }): Promise<ActiveAppearanceRow> {
    const appearance = await this.characterFactsRepository.findActiveAppearance(scope, tx);
    if (appearance === null) {
      throw characterNotFoundError();
    }
    return appearance;
  }
}

function characterNotFoundError(): NotFoundError {
  return new NotFoundError("Character not found", { code: CHARACTER_ERROR_CODES.notFound });
}

function factNotFoundError(): NotFoundError {
  return new NotFoundError("Fact not found", { code: CHARACTER_FACT_ERROR_CODES.notFound });
}

function toFactPatch(input: UpdateCharacterFactInput): CharacterFactPatch {
  const patch: CharacterFactPatch = {};
  if (input.title !== undefined) {
    patch.title = input.title;
  }
  if (input.text !== undefined) {
    patch.text = input.text;
  }
  if (input.chapter !== undefined) {
    patch.chapter = input.chapter;
  }
  if (input.page !== undefined) {
    patch.page = input.page;
  }
  return patch;
}
