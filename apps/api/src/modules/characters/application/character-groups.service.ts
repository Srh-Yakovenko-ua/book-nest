import type {
  CharacterGroupDetailsQuery,
  CharacterGroupDetailsView,
  CharacterGroupMemberInput,
  CharacterGroupsListQuery,
  CharacterGroupSummaryView,
  CreateCharacterGroup,
  Paginator,
  UpdateCharacterGroup,
  UpsertCharacterGroupMembership,
} from "@app/shared";

import { CHARACTER_GROUP_ERROR_CODES, normalizeName, normalizeSearch } from "@app/shared";
import { Injectable } from "@nestjs/common";

import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  CharacterGroupDetailsRow,
  CreateGroupData,
  GroupListFilter,
  UpdateGroupData,
} from "../infrastructure/character-groups.repository.js";

import { TransactionRunner } from "../../../core/database/transaction-runner.js";
import { NotFoundError, ValidationError } from "../../../core/exceptions/errors.js";
import { buildPaginator } from "../../../core/paginator.js";
import { BooksRepository } from "../../books/index.js";
import { emptyToNull } from "../domain/character-fields.js";
import { isMembershipVisibleInContext } from "../domain/character-group-visibility.js";
import {
  toCharacterGroupDetailsView,
  toCharacterGroupSummaryView,
} from "../domain/character-group.mapper.js";
import { resolveContextAllowedBookIds } from "../domain/context-books.js";
import { CharacterGroupsRepository } from "../infrastructure/character-groups.repository.js";
import { CharactersRepository } from "../infrastructure/characters.repository.js";

@Injectable()
export class CharacterGroupsService {
  constructor(
    private readonly characterGroupsRepository: CharacterGroupsRepository,
    private readonly charactersRepository: CharactersRepository,
    private readonly booksRepository: BooksRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async create({
    input,
    userId,
  }: {
    input: CreateCharacterGroup;
    userId: string;
  }): Promise<CharacterGroupDetailsView> {
    const seriesId = input.seriesId ?? null;
    if (seriesId !== null) {
      await this.assertSeriesOwned({ seriesId, userId });
    }
    const members = dedupeMembers(input.members);
    const bookIds = [
      ...new Set(
        members
          .map((member) => member.bookId)
          .filter((bookId): bookId is string => bookId !== null && bookId !== undefined),
      ),
    ];
    for (const bookId of bookIds) {
      await this.assertBookOwned({ bookId, userId });
    }

    const detailsRow = await this.transactionRunner.run(async (tx) => {
      if (members.length > 0) {
        await this.assertCharactersOwned(
          { characterIds: members.map((member) => member.characterId), userId },
          tx,
        );
      }
      const group = await this.characterGroupsRepository.createGroup(
        this.buildCreateData({ input, userId }),
        tx,
      );
      await this.characterGroupsRepository.createMemberships(
        members.map((member) => ({
          bookId: member.bookId ?? null,
          characterId: member.characterId,
          groupId: group.id,
          isSpoiler: member.isSpoiler,
          role: emptyToNull(member.role),
          status: emptyToNull(member.status),
        })),
        tx,
      );
      return this.loadDetails({ groupId: group.id, userId }, tx);
    });

    return this.toFullDetailsView(detailsRow);
  }

  async getDetails({
    groupId,
    query,
    userId,
  }: {
    groupId: string;
    query: CharacterGroupDetailsQuery;
    userId: string;
  }): Promise<CharacterGroupDetailsView> {
    const row = await this.characterGroupsRepository.findOwnedGroupDetails({ groupId, userId });
    if (row === null) {
      throw new NotFoundError("Character group not found", {
        code: CHARACTER_GROUP_ERROR_CODES.notFound,
      });
    }
    if (query.contextBookId === undefined) {
      return this.toFullDetailsView(row);
    }
    return this.toSafeDetailsView({ contextBookId: query.contextBookId, row, userId });
  }

  async list({
    query,
    userId,
  }: {
    query: CharacterGroupsListQuery;
    userId: string;
  }): Promise<Paginator<CharacterGroupSummaryView>> {
    if (query.seriesId !== undefined) {
      await this.assertSeriesOwned({ seriesId: query.seriesId, userId });
    }
    const filter: GroupListFilter = {
      search: normalizeSearch(query.q),
      seriesId: query.seriesId,
      type: query.type,
      userId,
    };

    const [rows, totalCount] = await Promise.all([
      this.characterGroupsRepository.listOwnedGroups({
        filter,
        skip: (query.pageNumber - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.characterGroupsRepository.countOwnedGroups(filter),
    ]);

    return buildPaginator({
      items: rows.map((row) =>
        toCharacterGroupSummaryView({
          group: row,
          memberCount: row._count.memberships,
          nameHidden: false,
        }),
      ),
      pageNumber: query.pageNumber,
      pageSize: query.pageSize,
      totalCount,
    });
  }

  async remove({ groupId, userId }: { groupId: string; userId: string }): Promise<void> {
    const deleted = await this.characterGroupsRepository.deleteOwnedGroup({ groupId, userId });
    if (deleted === 0) {
      throw new NotFoundError("Character group not found", {
        code: CHARACTER_GROUP_ERROR_CODES.notFound,
      });
    }
  }

  async removeMember({
    characterId,
    groupId,
    userId,
  }: {
    characterId: string;
    groupId: string;
    userId: string;
  }): Promise<void> {
    const group = await this.characterGroupsRepository.findOwnedGroupBare({ groupId, userId });
    if (group === null) {
      throw new NotFoundError("Character group not found", {
        code: CHARACTER_GROUP_ERROR_CODES.notFound,
      });
    }
    const deleted = await this.characterGroupsRepository.deleteMembershipsByCharacter({
      characterId,
      groupId,
    });
    if (deleted === 0) {
      throw new NotFoundError("Character group membership not found", {
        code: CHARACTER_GROUP_ERROR_CODES.membershipNotFound,
      });
    }
  }

  async update({
    groupId,
    input,
    userId,
  }: {
    groupId: string;
    input: UpdateCharacterGroup;
    userId: string;
  }): Promise<CharacterGroupDetailsView> {
    if (input.seriesId !== undefined && input.seriesId !== null) {
      await this.assertSeriesOwned({ seriesId: input.seriesId, userId });
    }

    const detailsRow = await this.transactionRunner.run(async (tx) => {
      const existing = await this.characterGroupsRepository.findOwnedGroupBare(
        { groupId, userId },
        tx,
      );
      if (existing === null) {
        throw new NotFoundError("Character group not found", {
          code: CHARACTER_GROUP_ERROR_CODES.notFound,
        });
      }
      await this.characterGroupsRepository.updateGroup(
        { data: this.buildUpdateData({ input, storedType: existing.type }), groupId },
        tx,
      );
      return this.loadDetails({ groupId, userId }, tx);
    });

    return this.toFullDetailsView(detailsRow);
  }

  async upsertMember({
    characterId,
    groupId,
    input,
    userId,
  }: {
    characterId: string;
    groupId: string;
    input: UpsertCharacterGroupMembership;
    userId: string;
  }): Promise<CharacterGroupDetailsView> {
    const bookId = input.bookId ?? null;
    if (bookId !== null) {
      await this.assertBookOwned({ bookId, userId });
    }

    const detailsRow = await this.transactionRunner.run(async (tx) => {
      const group = await this.characterGroupsRepository.findOwnedGroupBare(
        { groupId, userId },
        tx,
      );
      if (group === null) {
        throw new NotFoundError("Character group not found", {
          code: CHARACTER_GROUP_ERROR_CODES.notFound,
        });
      }
      const ownedCharacters = await this.characterGroupsRepository.countOwnedCharacters(
        { characterIds: [characterId], userId },
        tx,
      );
      if (ownedCharacters === 0) {
        throw new NotFoundError("Character not found", {
          code: CHARACTER_GROUP_ERROR_CODES.memberCharacterNotFound,
        });
      }

      await this.characterGroupsRepository.acquireMembershipLock(
        { bookId, characterId, groupId },
        tx,
      );
      const existing = await this.characterGroupsRepository.findMembership(
        { bookId, characterId, groupId },
        tx,
      );
      const data = {
        isSpoiler: input.isSpoiler,
        role: emptyToNull(input.role),
        status: emptyToNull(input.status),
      };
      if (existing === null) {
        await this.characterGroupsRepository.createMembership(
          { ...data, bookId, characterId, groupId },
          tx,
        );
      } else {
        await this.characterGroupsRepository.updateMembership({ data, id: existing.id }, tx);
      }
      return this.loadDetails({ groupId, userId }, tx);
    });

    return this.toFullDetailsView(detailsRow);
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
      throw new NotFoundError("Book not found", { code: CHARACTER_GROUP_ERROR_CODES.bookNotFound });
    }
  }

  private async assertCharactersOwned(
    { characterIds, userId }: { characterIds: string[]; userId: string },
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const uniqueIds = [...new Set(characterIds)];
    const owned = await this.characterGroupsRepository.countOwnedCharacters(
      { characterIds: uniqueIds, userId },
      tx,
    );
    if (owned !== uniqueIds.length) {
      throw new NotFoundError("Character not found", {
        code: CHARACTER_GROUP_ERROR_CODES.memberCharacterNotFound,
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
        code: CHARACTER_GROUP_ERROR_CODES.seriesNotFound,
      });
    }
  }

  private buildCreateData({
    input,
    userId,
  }: {
    input: CreateCharacterGroup;
    userId: string;
  }): CreateGroupData {
    return {
      customType: input.type === "custom" ? emptyToNull(input.customType) : null,
      description: emptyToNull(input.description),
      isSpoiler: input.isSpoiler,
      name: input.name,
      normalizedName: normalizeName(input.name),
      seriesId: input.seriesId ?? null,
      type: input.type,
      userId,
    };
  }

  private buildUpdateData({
    input,
    storedType,
  }: {
    input: UpdateCharacterGroup;
    storedType: string;
  }): UpdateGroupData {
    const data: UpdateGroupData = {};
    if (input.name !== undefined) {
      data.name = input.name;
      data.normalizedName = normalizeName(input.name);
    }
    if (input.type !== undefined) {
      data.type = input.type;
    }
    const effectiveType = input.type ?? storedType;
    if (effectiveType === "custom") {
      if (input.customType !== undefined) {
        const customType = emptyToNull(input.customType);
        if (customType === null) {
          throw new ValidationError("customType is required when type is custom", {
            code: CHARACTER_GROUP_ERROR_CODES.validationFailed,
          });
        }
        data.customType = customType;
      }
    } else if (input.type !== undefined || input.customType !== undefined) {
      data.customType = null;
    }
    if (input.description !== undefined) {
      data.description = emptyToNull(input.description);
    }
    if (input.seriesId !== undefined) {
      data.seriesId = input.seriesId ?? null;
    }
    if (input.isSpoiler !== undefined) {
      data.isSpoiler = input.isSpoiler;
    }
    return data;
  }

  private async loadDetails(
    { groupId, userId }: { groupId: string; userId: string },
    tx: Prisma.TransactionClient,
  ): Promise<CharacterGroupDetailsRow> {
    const row = await this.characterGroupsRepository.findOwnedGroupDetails({ groupId, userId }, tx);
    if (row === null) {
      throw new NotFoundError("Character group not found", {
        code: CHARACTER_GROUP_ERROR_CODES.notFound,
      });
    }
    return row;
  }

  private toFullDetailsView(row: CharacterGroupDetailsRow): CharacterGroupDetailsView {
    return toCharacterGroupDetailsView({
      group: row,
      members: row.memberships,
      nameHidden: false,
    });
  }

  private async toSafeDetailsView({
    contextBookId,
    row,
    userId,
  }: {
    contextBookId: string;
    row: CharacterGroupDetailsRow;
    userId: string;
  }): Promise<CharacterGroupDetailsView> {
    const allowedBookIds = await resolveContextAllowedBookIds({
      contextBookId,
      notFoundCode: CHARACTER_GROUP_ERROR_CODES.bookNotFound,
      reader: this.charactersRepository,
      userId,
    });
    const presence = await this.characterGroupsRepository.listMembershipPresence({
      allowedBookIds,
      characterIds: [...new Set(row.memberships.map((membership) => membership.characterId))],
      userId,
    });
    const hiddenProfileCharacterIds = new Set(
      row.memberships
        .filter((membership) => membership.character.hideProfileAsSpoiler)
        .map((membership) => membership.characterId),
    );
    const context = {
      allowedBookIds: new Set(allowedBookIds),
      hiddenPresenceCharacterIds: new Set(presence.hiddenPresenceCharacterIds),
      hiddenProfileCharacterIds,
      revealedCharacterIds: new Set(presence.revealedCharacterIds),
    };

    const visibleMembers = row.memberships.filter((membership) =>
      isMembershipVisibleInContext({ context, membership }),
    );

    return toCharacterGroupDetailsView({
      group: row,
      members: visibleMembers,
      nameHidden: row.isSpoiler,
    });
  }
}

function dedupeMembers(members: CharacterGroupMemberInput[]): CharacterGroupMemberInput[] {
  const seen = new Set<string>();
  return members.filter((member) => {
    const key = `${member.characterId}:${member.bookId ?? "global"}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
