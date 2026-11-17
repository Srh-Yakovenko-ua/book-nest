import { Injectable } from "@nestjs/common";

import type { GlobalCharacterFilter } from "./characters.repository.js";

import { PrismaService } from "../../../core/database/prisma.service.js";
import {
  buildGlobalCharacterWhere,
  scopeAppearanceToContextBook,
  scopeMembershipToContextBook,
  spoilerSearchScope,
} from "./characters.repository.js";

export type CharacterFacetCountRow = {
  count: number;
  value: string;
};

type CharacterValuePair = {
  characterId: string;
  value: string;
};

@Injectable()
export class CharacterFacetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countByAttitude(filter: GlobalCharacterFilter): Promise<CharacterFacetCountRow[]> {
    const groups = await this.prisma.character.groupBy({
      _count: { _all: true },
      by: ["globalAttitude"],
      where: { AND: [buildGlobalCharacterWhere(filter), { globalAttitude: { not: null } }] },
    });
    return groups.flatMap((group) =>
      group.globalAttitude === null
        ? []
        : [{ count: group._count._all, value: group.globalAttitude }],
    );
  }

  async countByGender(filter: GlobalCharacterFilter): Promise<CharacterFacetCountRow[]> {
    const groups = await this.prisma.character.groupBy({
      _count: { _all: true },
      by: ["gender"],
      where: buildGlobalCharacterWhere(filter),
    });
    return groups.map((group) => ({ count: group._count._all, value: group.gender }));
  }

  async countByGroup(filter: GlobalCharacterFilter): Promise<CharacterFacetCountRow[]> {
    const memberships = await this.prisma.characterGroupMembership.groupBy({
      by: ["groupId", "characterId"],
      where: scopeMembershipToContextBook({
        contextBookId: filter.contextBookId,
        extra: {
          character: buildGlobalCharacterWhere(filter),
          ...spoilerSearchScope(filter.includeSpoilerSearch),
        },
      }),
    });
    return countDistinctCharacters(
      memberships.map((membership) => ({
        characterId: membership.characterId,
        value: membership.groupId,
      })),
    );
  }

  async countByImportance(filter: GlobalCharacterFilter): Promise<CharacterFacetCountRow[]> {
    const appearances = await this.prisma.bookCharacter.groupBy({
      by: ["importance", "characterId"],
      where: scopeAppearanceToContextBook({
        contextBookId: filter.contextBookId,
        extra: { character: buildGlobalCharacterWhere(filter) },
      }),
    });
    return countDistinctCharacters(
      appearances.map((appearance) => ({
        characterId: appearance.characterId,
        value: appearance.importance,
      })),
    );
  }

  async countByRole(filter: GlobalCharacterFilter): Promise<CharacterFacetCountRow[]> {
    const roles = await this.prisma.bookCharacterRole.findMany({
      select: { bookCharacter: { select: { characterId: true } }, roleType: true },
      where: {
        ...spoilerSearchScope(filter.includeSpoilerSearch),
        bookCharacter: scopeAppearanceToContextBook({
          contextBookId: filter.contextBookId,
          extra: { character: buildGlobalCharacterWhere(filter) },
        }),
      },
    });
    return countDistinctCharacters(
      roles.map((role) => ({ characterId: role.bookCharacter.characterId, value: role.roleType })),
    );
  }

  async countBySpecies(filter: GlobalCharacterFilter): Promise<CharacterFacetCountRow[]> {
    const groups = await this.prisma.character.groupBy({
      _count: { _all: true },
      by: ["speciesId"],
      where: { AND: [buildGlobalCharacterWhere(filter), { speciesId: { not: null } }] },
    });
    return groups.flatMap((group) =>
      group.speciesId === null ? [] : [{ count: group._count._all, value: group.speciesId }],
    );
  }

  async countByTag(filter: GlobalCharacterFilter): Promise<CharacterFacetCountRow[]> {
    const groups = await this.prisma.characterTag.groupBy({
      _count: { _all: true },
      by: ["tagId"],
      where: { character: buildGlobalCharacterWhere(filter) },
    });
    return groups.map((group) => ({ count: group._count._all, value: group.tagId }));
  }
}

function countDistinctCharacters(pairs: readonly CharacterValuePair[]): CharacterFacetCountRow[] {
  const charactersByValue = new Map<string, Set<string>>();
  for (const pair of pairs) {
    const characterIds = charactersByValue.get(pair.value) ?? new Set<string>();
    characterIds.add(pair.characterId);
    charactersByValue.set(pair.value, characterIds);
  }
  return [...charactersByValue].map(([value, characterIds]) => ({
    count: characterIds.size,
    value,
  }));
}
