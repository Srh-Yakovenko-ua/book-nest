import type {
  CatalogLocale,
  Nullable,
  OwnSpeciesList,
  SpeciesCandidates,
  SpeciesDeletionPreview,
  SpeciesMergeResult,
  SpeciesOptionView,
  SpeciesSearchQuery,
  SpeciesSearchResult,
  SpeciesUsage,
} from "@app/shared";

import { SPECIES_ERROR_CODES, SPECIES_SEARCH } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  PortableSpeciesCandidate,
  PortableSpeciesRef,
  PortableSpeciesResolver,
} from "../domain/species-portability.js";
import type { SpeciesViewContext } from "../domain/species.mapper.js";
import type { SpeciesWithNames } from "../infrastructure/species.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../../core/exceptions/errors.js";
import {
  isForeignKeyConstraintError,
  isUniqueConstraintError,
} from "../../../core/prisma-errors.js";
import { findExactSpeciesMatch, findSimilarSpecies } from "../domain/species-name-matching.js";
import { normalizeSpeciesName } from "../domain/species-name-normalizer.js";
import {
  hasPortableSpeciesIdentity,
  importableSpeciesName,
  matchPortableSpecies,
  portableSpeciesRefId,
} from "../domain/species-portability.js";
import {
  rankSpeciesMatches,
  SPECIES_QUERY_TUNING,
  speciesNormalizedNames,
} from "../domain/species-search.js";
import { isSpeciesInUse, NO_SPECIES_USAGE } from "../domain/species-usage.js";
import { speciesDisplayName, toSpeciesOptionView } from "../domain/species.mapper.js";
import { SpeciesCategoryLabelsSource } from "../infrastructure/species-category-labels.source.js";
import { SpeciesRepository } from "../infrastructure/species.repository.js";

type DuplicateRethrowInput = {
  context: SpeciesViewContext;
  error: unknown;
  excludeSpeciesId?: string;
  normalizedName: string;
};

type NamedSpeciesInput = ViewerInput & {
  name: string;
};

type NameHolderInput = {
  excludeSpeciesId?: string;
  normalizedName: string;
  userId: string;
};

type SpeciesAccessInput = {
  speciesId: string;
  userId: string;
};

type ViewerInput = {
  locale: CatalogLocale;
  userId: string;
};

@Injectable()
export class SpeciesService {
  constructor(
    private readonly speciesRepository: SpeciesRepository,
    private readonly categoryLabelsSource: SpeciesCategoryLabelsSource,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async assertReferenceable(
    { speciesId, userId }: SpeciesAccessInput,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const visible = await this.speciesRepository.lockVisibleForReference(
      { id: speciesId, userId },
      client,
    );
    if (!visible) {
      throw speciesNotFoundError();
    }
  }

  async candidates({ locale, name, userId }: NamedSpeciesInput): Promise<SpeciesCandidates> {
    const context = this.viewContext({ locale, userId });
    const visible = await this.speciesRepository.findAllVisible(userId);
    const normalizedName = normalizeSpeciesName(name);
    const candidates = visible.map((species) => ({
      normalizedNames: speciesNormalizedNames(species),
      species,
    }));

    const exact = findExactSpeciesMatch({ candidates, normalizedName });
    const similar = exceedsSpeciesNameLength(normalizedName)
      ? []
      : findSimilarSpecies({
          candidates,
          limit: SPECIES_QUERY_TUNING.similarLimit,
          normalizedName,
        });

    return {
      exact: exact === null ? null : toSpeciesOptionView({ context, species: exact.species }),
      similar: similar.map((candidate) =>
        toSpeciesOptionView({ context, species: candidate.species }),
      ),
    };
  }

  async create({ locale, name, userId }: NamedSpeciesInput): Promise<SpeciesOptionView> {
    const context = this.viewContext({ locale, userId });
    const normalizedName = normalizeSpeciesName(name);

    try {
      const created = await this.transactionRunner.run(async (tx) => {
        await this.speciesRepository.acquireUserLock(userId, tx);
        await this.assertNameAvailable({ context, normalizedName }, tx);
        return this.speciesRepository.createCustom({ name, normalizedName, userId }, tx);
      });
      return toSpeciesOptionView({ context, species: created });
    } catch (error) {
      return this.rethrowAsDuplicate({ context, error, normalizedName });
    }
  }

  async deleteOwn({ speciesId, userId }: SpeciesAccessInput): Promise<void> {
    try {
      await this.transactionRunner.run(async (tx) => {
        await this.speciesRepository.acquireUserLock(userId, tx);
        await this.loadOwnCustom({ speciesId, userId }, tx);
        const usage = await this.usageOf({ speciesId, userId }, tx);
        if (isSpeciesInUse(usage)) {
          throw speciesInUseError(usage);
        }
        await this.speciesRepository.deleteCustom({ id: speciesId, userId }, tx);
      });
    } catch (error) {
      if (!isForeignKeyConstraintError(error)) {
        throw error;
      }
      throw speciesInUseError(await this.usageOf({ speciesId, userId }));
    }
  }

  async deletionPreview({
    speciesId,
    userId,
  }: SpeciesAccessInput): Promise<SpeciesDeletionPreview> {
    await this.loadOwnCustom({ speciesId, userId });
    const usage = await this.usageOf({ speciesId, userId });
    return { ...usage, canDelete: !isSpeciesInUse(usage) };
  }

  async listOwn({ locale, userId }: ViewerInput): Promise<OwnSpeciesList> {
    const context = this.viewContext({ locale, userId });
    const own = await this.speciesRepository.findOwn(userId);
    const usageBySpecies = await this.speciesRepository.countUsage({
      speciesIds: own.map((species) => species.id),
      userId,
    });

    return {
      items: own.map((species) => ({
        ...toSpeciesOptionView({ context, species }),
        usage: usageBySpecies.get(species.id) ?? NO_SPECIES_USAGE,
      })),
    };
  }

  async merge({
    locale,
    sourceId,
    targetId,
    userId,
  }: ViewerInput & { sourceId: string; targetId: string }): Promise<SpeciesMergeResult> {
    if (sourceId === targetId) {
      throw new BadRequestError("A species cannot be merged into itself", {
        code: SPECIES_ERROR_CODES.mergeSelf,
      });
    }
    const context = this.viewContext({ locale, userId });

    try {
      const merged = await this.transactionRunner.run(async (tx) => {
        await this.speciesRepository.acquireUserLock(userId, tx);
        await this.loadOwnCustom({ speciesId: sourceId, userId }, tx);
        const target = await this.speciesRepository.findVisibleById({ id: targetId, userId }, tx);
        if (target === null) {
          throw new ValidationError("The merge target is not available", {
            code: SPECIES_ERROR_CODES.mergeInvalidTarget,
          });
        }
        const reassigned = await this.speciesRepository.reassignReferences(
          { sourceId, targetId, userId },
          tx,
        );
        await this.speciesRepository.deleteCustom({ id: sourceId, userId }, tx);
        return { reassigned, target };
      });
      return {
        reassigned: merged.reassigned,
        target: toSpeciesOptionView({ context, species: merged.target }),
      };
    } catch (error) {
      if (isForeignKeyConstraintError(error)) {
        throw speciesMergeConflictError();
      }
      throw error;
    }
  }

  async rename({
    locale,
    name,
    speciesId,
    userId,
  }: NamedSpeciesInput & { speciesId: string }): Promise<SpeciesOptionView> {
    const context = this.viewContext({ locale, userId });
    const normalizedName = normalizeSpeciesName(name);

    try {
      const renamed = await this.transactionRunner.run(async (tx) => {
        await this.speciesRepository.acquireUserLock(userId, tx);
        await this.loadOwnCustom({ speciesId, userId }, tx);
        await this.assertNameAvailable(
          { context, excludeSpeciesId: speciesId, normalizedName },
          tx,
        );
        return this.speciesRepository.renameCustom(
          { id: speciesId, name, normalizedName, userId },
          tx,
        );
      });
      return toSpeciesOptionView({ context, species: renamed });
    } catch (error) {
      return this.rethrowAsDuplicate({
        context,
        error,
        excludeSpeciesId: speciesId,
        normalizedName,
      });
    }
  }

  async resolvePortableRefs(
    { refs, userId }: { refs: readonly PortableSpeciesRef[]; userId: string },
    client: Prisma.TransactionClient,
  ): Promise<PortableSpeciesResolver> {
    const identifiable = refs.filter((ref) => hasPortableSpeciesIdentity(ref));
    const resolvedIds = new Map<string, string>();
    if (identifiable.length === 0) {
      return () => null;
    }

    await this.speciesRepository.acquireUserLock(userId, client);
    const visible = await this.speciesRepository.findAllVisible(userId, client);
    const candidates = visible.map((species) => toPortableCandidate(species));

    for (const ref of identifiable) {
      const refId = portableSpeciesRefId(ref);
      if (resolvedIds.has(refId)) continue;
      const matched = matchPortableSpecies({ candidates, ref });
      const resolved = matched ?? (await this.createImportedSpecies({ ref, userId }, client));
      if (resolved === null) continue;
      if (matched === null) {
        candidates.push(resolved);
      }
      resolvedIds.set(refId, resolved.id);
    }

    return (ref) => resolvedIds.get(portableSpeciesRefId(ref)) ?? null;
  }

  async search({
    query,
    userId,
  }: {
    query: SpeciesSearchQuery;
    userId: string;
  }): Promise<SpeciesSearchResult> {
    const { locale } = query;
    const context = this.viewContext({ locale, userId });
    const normalizedQuery = normalizeSpeciesName(query.q ?? "");

    if (normalizedQuery.length < SPECIES_SEARCH.minQueryLength) {
      return { items: await this.emptyQueryItems(context) };
    }

    const matches = await this.speciesRepository.searchVisible({ normalizedQuery, userId });
    const ranked = rankSpeciesMatches({
      candidates: matches.map((species) => ({
        displayName: speciesDisplayName({ locale, species }),
        id: species.id,
        normalizedNames: speciesNormalizedNames(species),
        species,
      })),
      limit: SPECIES_SEARCH.maxResults,
      locale,
      normalizedQuery,
    });

    return {
      items: ranked.map((candidate) =>
        toSpeciesOptionView({ context, species: candidate.species }),
      ),
    };
  }

  private async assertNameAvailable(
    {
      context,
      excludeSpeciesId,
      normalizedName,
    }: { context: SpeciesViewContext; excludeSpeciesId?: string; normalizedName: string },
    client: Prisma.TransactionClient,
  ): Promise<void> {
    const holder = await this.findNameHolder(
      { excludeSpeciesId, normalizedName, userId: context.userId },
      client,
    );
    if (holder !== null) {
      throw speciesDuplicateError(toSpeciesOptionView({ context, species: holder }));
    }
  }

  private async createImportedSpecies(
    { ref, userId }: { ref: PortableSpeciesRef; userId: string },
    client: Prisma.TransactionClient,
  ): Promise<Nullable<PortableSpeciesCandidate>> {
    const importable = importableSpeciesName(ref);
    if (importable === null) {
      return null;
    }
    const created = await this.speciesRepository.createCustom({ ...importable, userId }, client);
    return toPortableCandidate(created);
  }

  private async emptyQueryItems(context: SpeciesViewContext): Promise<SpeciesOptionView[]> {
    const [popular, ownRecent] = await Promise.all([
      this.speciesRepository.findSystemByKeys(SPECIES_QUERY_TUNING.popularKeys),
      this.speciesRepository.findOwnRecent({
        limit: SPECIES_QUERY_TUNING.ownRecentLimit,
        userId: context.userId,
      }),
    ]);
    const popularByKey = new Map(popular.map((species) => [species.key, species]));
    const orderedPopular = SPECIES_QUERY_TUNING.popularKeys.flatMap((key) => {
      const species = popularByKey.get(key);
      return species === undefined ? [] : [species];
    });

    return [...orderedPopular, ...ownRecent].map((species) =>
      toSpeciesOptionView({ context, species }),
    );
  }

  private async findNameHolder(
    { excludeSpeciesId, normalizedName, userId }: NameHolderInput,
    client?: Prisma.TransactionClient,
  ): Promise<Nullable<SpeciesWithNames>> {
    const holders = await this.speciesRepository.findVisibleByNormalizedName(
      { normalizedName, userId },
      client,
    );
    return holders.find((species) => species.id !== excludeSpeciesId) ?? null;
  }

  private async loadOwnCustom(
    { speciesId, userId }: SpeciesAccessInput,
    client?: Prisma.TransactionClient,
  ): Promise<SpeciesWithNames> {
    const species = await this.speciesRepository.findVisibleById({ id: speciesId, userId }, client);
    if (species === null) {
      throw speciesNotFoundError();
    }
    if (species.userId === null) {
      throw new ForbiddenError("System species cannot be changed", {
        code: SPECIES_ERROR_CODES.forbidden,
      });
    }
    return species;
  }

  private async rethrowAsDuplicate({
    context,
    error,
    excludeSpeciesId,
    normalizedName,
  }: DuplicateRethrowInput): Promise<never> {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }
    const holder = await this.findNameHolder({
      excludeSpeciesId,
      normalizedName,
      userId: context.userId,
    });
    throw speciesDuplicateError(
      holder === null ? null : toSpeciesOptionView({ context, species: holder }),
    );
  }

  private async usageOf(
    { speciesId, userId }: SpeciesAccessInput,
    client?: Prisma.TransactionClient,
  ): Promise<SpeciesUsage> {
    const usage = await this.speciesRepository.countUsage(
      { speciesIds: [speciesId], userId },
      client,
    );
    return usage.get(speciesId) ?? NO_SPECIES_USAGE;
  }

  private viewContext({ locale, userId }: ViewerInput): SpeciesViewContext {
    return { categoryLabels: this.categoryLabelsSource.load(), locale, userId };
  }
}

function exceedsSpeciesNameLength(normalizedName: string): boolean {
  return Array.from(normalizedName).length > SPECIES_SEARCH.nameMax;
}

function speciesDuplicateError(species: Nullable<SpeciesOptionView>): ConflictError {
  return new ConflictError("A species with this name already exists", {
    code: SPECIES_ERROR_CODES.duplicate,
    details: species === null ? undefined : { species },
  });
}

function speciesInUseError(usage: SpeciesUsage): ConflictError {
  return new ConflictError("The species is still used by characters", {
    code: SPECIES_ERROR_CODES.inUse,
    details: { ...usage },
  });
}

function speciesMergeConflictError(): ConflictError {
  return new ConflictError("The merge conflicted with a concurrent change", {
    code: SPECIES_ERROR_CODES.mergeConflict,
  });
}

function speciesNotFoundError(): NotFoundError {
  return new NotFoundError("Species not found", { code: SPECIES_ERROR_CODES.notFound });
}

function toPortableCandidate(species: SpeciesWithNames): PortableSpeciesCandidate {
  return {
    id: species.id,
    key: species.key,
    normalizedNames: speciesNormalizedNames(species),
  };
}
